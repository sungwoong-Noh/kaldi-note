import pathlib
COMMON = pathlib.Path("_common.css").read_text(encoding="utf-8")
TPL = '''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <style>
{css}
  </style>
</helmet>
{body}
</x-dc>
<script data-dc-script data-props='{props}'>
class Component extends DCLogic {{
  renderVals() {{
    return {vals};
  }}
}}
</script>
</body>
</html>
'''
def write(name, body, props="{}", vals="{}"):
    css = "\n".join("    " + l for l in COMMON.strip().split("\n"))
    out = TPL.format(css=css, body=body.strip(), props=props, vals=vals)
    pathlib.Path(name).write_text(out, encoding="utf-8")
    print(f"  {name}  {len(out):,} bytes")
