import re

files = [
    'src/components/auth/ForgotPasswordForm.tsx',
    'src/components/auth/LoginForm.tsx',
    'src/components/auth/NewPasswordForm.tsx',
    'src/components/Chatbot.tsx',
    'src/components/InsightCard.tsx',
]
for p in files:
    s = open(p, encoding='utf-8').read()
    s, n = re.subn(r'<Loader2 size=\{(\d+)\} className="animate-spin" />', r'<Loader size={\1} />', s)
    assert n >= 1, p
    s = s.replace('\n  Loader2,', '', 1) if '\n  Loader2,' in s else s.replace('Loader2, ', '', 1)
    assert 'Loader2' not in s, p
    # add the import after the lucide-react import
    m = re.search(r'from "lucide-react";\n', s)
    assert m, p
    s = s[:m.end()] + 'import { Loader } from "@/components/prompt-kit/loader";\n' + s[m.end():]
    open(p, 'w', encoding='utf-8').write(s)
print('ok')
