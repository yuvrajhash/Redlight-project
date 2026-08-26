# Security policy

Do not report vulnerabilities in a public issue. Contact the repository owner, Yuvraj Choudhary,
through the private contact method listed on the GitHub profile `yuvrajhash`.

Never commit API keys, OAuth secrets, signing certificates, passwords, access tokens, or production
environment files. Release signing and macOS notarization require owner-controlled CI secrets and
must fail closed when those credentials are absent.
