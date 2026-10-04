# Summary: Login e criar conta ligam o cabeçalho a `/`

O ícone de login e de criar conta (`Auth`, ecrãs de entrada) é um link para `/`. Recuperar palavra-passe, nova palavra-passe e completar perfil mantêm o ícone estático. `BrandLockup` no shell autenticado não ganhou destino.

Ficheiros: `src/pages/Auth.jsx`, `src/pages/Auth.test.jsx`, `src/layouts/Layout.test.jsx`.
