import urllib.request
import json

url = "http://127.0.0.1:22346/mcp"
api_key = "0faf260abfe80437bfc3343cbc3592d812b2f8dcee17184bd4d8b9c15fd8fb41f9992408fb24346771754149f26b4b9164048d7147708dc03135a1a9c33c8dd337d7fee2c9f26ea14347abb32ba4084eff9f3d21"

headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": "2025-06-18"
}

init_payload = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-06-18",
        "capabilities": {},
        "clientInfo": {
            "name": "antigravity",
            "version": "1.0"
        }
    }
}

req = urllib.request.Request(url, data=json.dumps(init_payload).encode("utf-8"), headers=headers, method="POST")
try:
    with urllib.request.urlopen(req, timeout=5) as resp:
        print("Status:", resp.status)
        print("Response:", resp.read().decode("utf-8"))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code, e.reason)
    print("Body:", e.read().decode("utf-8"))
except Exception as e:
    print("Error:", e)
