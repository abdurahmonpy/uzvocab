# Abdurahmon's APP — IELTS lug'ati

Oq dizayndagi, ko'p sahifali statik sayt. Build kerak emas.

## Sahifalar
- `index.html` — bosh sahifa (daraja, seriya, so'zlar xaritasi)
- `cards.html` — kartochkalar
- `quiz.html` — tezkor test
- `match.html` — juftlik topish
- `type.html` — yozib yodlash
- `dict.html` — lug'at (qidiruv)
- `add.html` — saytning o'zidan yangi so'z qo'shish (faqat shu brauzerda saqlanadi)

## Yangi so'z qo'shish
`add.html` sahifasidan (yoki `assets/words.js` faylini oching va ro'yxat oxiriga qator qo'shing:

    ["inglizcha so'z", "sinonim1, sinonim2", "o'zbekcha tarjima"],

Eski so'zlarni o'chirmang yoki o'rnini almashtirmang (natijalar tartib raqamiga bog'langan).
Har 10 ta so'z avtomatik to'plamga bo'linadi.

## Vercel'ga joylash
1. Papkani GitHub'ga yuklang va vercel.com da "Add New → Project" orqali ulang.
   Framework Preset: **Other**, Build Command va Output Directory — bo'sh qoldiring.
2. Yoki terminalda: `npx vercel --prod`
