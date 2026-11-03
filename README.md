# Planta — projete sua casa em 2D e 3D

Editor de plantas no navegador: paredes, portas, janelas, vãos, cômodos com área automática, cotas, 34 móveis com medidas reais, vários andares, visão 3D orbital e "andar pela casa".
**No ar:** https://codewithgabs.github.io/planta/

Tudo fica salvo no localStorage do navegador (exporta e importa `.json`).

## Rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run test     # testes de geometria
npm run build    # site estático em dist/ (pode publicar em Vercel/Netlify)
```

## Atalhos
V selecionar · W parede · C cômodo · Shift+C cômodo livre · P porta · J janela · O vão · M cota · H mão
Ctrl+Z / Ctrl+Shift+Z · Del excluir · R girar móvel · Ctrl+C/V/D · Espaço+arrastar move a vista.
Desenhando parede: digite a medida (ex.: `3,45`) e Enter.
