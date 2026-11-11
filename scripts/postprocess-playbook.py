#!/usr/bin/env python3
"""Post-process Trade-Formulation-Playbook.docx for WPS page-number compatibility:
   - footer1 (TOC section): PAGE -> PAGE \\* ROMAN \\* MERGEFORMAT
   - footer2 (body section): PAGE -> PAGE \\* arabic \\* MERGEFORMAT
   - remove empty <w:pgNumType/> from the cover section
"""
import re
import shutil
import sys
import zipfile

path = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/download/Trade-Formulation-Playbook.docx"
tmp = path + ".tmp"

with zipfile.ZipFile(path, "r") as zin:
    names = zin.namelist()
    data = {n: zin.read(n) for n in names}

# 1. patch footer instrText (footer1 = roman / TOC, footer2 = arabic / body)
def patch_footer(name, fmt):
    xml = data[name].decode("utf-8")
    xml, n = re.subn(
        r"(<w:instrText[^>]*>)\s*PAGE\s*(</w:instrText>)",
        r"\g<1> PAGE \\* " + fmt + r" \\* MERGEFORMAT \g<2>",
        xml,
    )
    data[name] = xml.encode("utf-8")
    return n

n1 = patch_footer("word/footer1.xml", "ROMAN")
n2 = patch_footer("word/footer2.xml", "arabic")

# 2. remove empty pgNumType from document.xml
doc = data["word/document.xml"].decode("utf-8")
doc, n3 = re.subn(r"<w:pgNumType/>", "", doc)

# 3. de-duplicate the first TOC entry: the injector adds a hyperlink entry
#    AND a plain-text duplicate of heading #1. Remove the plain duplicate.
plain_dup = (
    '<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9026"/></w:tabs>'
    '<w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:t>1. Executive Summary</w:t></w:r>'
    '<w:r><w:tab/></w:r><w:r><w:t>1</w:t></w:r></w:p>'
)
if plain_dup in doc:
    doc = doc.replace(plain_dup, "", 1)
    n4 = 1
else:
    n4 = 0

# 4. cache a visible result inside the first entry's PAGEREF field so the
#    first TOC line shows its page number even before a field update
doc, n5 = re.subn(
    r'(<w:instrText xml:space="preserve">PAGEREF _Toc1 \\h</w:instrText><w:fldChar w:fldCharType="separate"/>)(<w:fldChar w:fldCharType="end"/>)',
    r"\g<1><w:r><w:t>1</w:t></w:r>\g<2>",
    doc,
)

data["word/document.xml"] = doc.encode("utf-8")

with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for n in names:
        zout.writestr(n, data[n])
shutil.move(tmp, path)
print(f"patched: footer1 roman x{n1}, footer2 arabic x{n2}, pgNumType x{n3}, toc-dedup x{n4}, pageref-cache x{n5}")
