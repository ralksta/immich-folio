import re
with open("lib/config/index.ts", "r") as f:
    text = f.read()

text = text.replace(
    "if (process.env.NODE_ENV === 'production') {",
    "if (process.env.NODE_ENV === 'production' && !process.env.CI) {"
)

with open("lib/config/index.ts", "w") as f:
    f.write(text)
