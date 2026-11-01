# 🎰 Kazino su draugais (žaidimo pinigai)

Internetinis kelių žaidėjų kazino žaidimas draugams. **Visi pinigai yra žaidimo pinigai, ne tikri.** Jų negalima įnešti, išsiimti ar iškeisti. Nėra jokių mokėjimų, kortelių ar banko laukų, nėra prizų.

Tai **vienas bendras kazino** visiems: jokių kambarių ar kodų. Kiekvienas susikuria paskyrą su slapyvardžiu ir slaptažodžiu, o **balansas išsaugomas duomenų bazėje**, todėl išlieka ir perkrovus serverį.

| Žaidimas | Režimas | Taisyklės |
|---|---|---|
| 🃏 Blackjack | bendri stalai „Stalas 1“, „Stalas 2“… (iki 7 žaidėjų prie stalo; prisipildžius automatiškai atsiranda naujas) | 6 kaladžių batas, dalintojas stovi ant minkštų 17, blackjack moka 3:2, dvigubinimas, vienas skaidymas, šalutiniai statymai Perfect Pairs ir 21+3 |
| 🎯 Ruletė | viena bendra visiems, žaidėjų skaičius neribojamas | Europietiška (vienas nulis), numeris 35:1, tuzinai/stulpeliai 2:1, spalva/lyginis/pusė 1:1 |
| 🎡 Laimės ratas | vienas bendras visiems, žaidėjų skaičius neribojamas | 54 segmentai, daugiklio langelis, 4 premijos, grąžinimas apie 95 % kiekvienam statymui |
| 🎲 Kauliukai | individualiai | 99 % grąžinimas |
| 🍒 Automatas | individualiai | 3 būgnai, 95,15 % grąžinimas |

Taip pat yra:
- bendras pokalbis;
- sąrašas „Dabar žaidžia“;
- **lyderių lentelė**: 10 turtingiausių žaidėjų iš duomenų bazės, įskaitant atsijungusius;
- profilis: avataras, sužaistų raundų skaičius, didžiausias laimėjimas, iš viso pastatyta;
- balanso papildymas žaidimo pinigais („Papildyti balansą“).

---

## 1. Paskyros ir slapyvardžiai

- **Slapyvardis:** 3–16 simbolių, tik raidės (galima ir lietuviškos), skaičiai ir `_`. Jis unikalus, o didžiosios ir mažosios raidės nesiskiria: jei yra `Dovis`, `dovis` užregistruoti nebegalima.
- **Slaptažodis:** 6–100 simbolių. Serveryje jis saugomas tik kaip **scrypt maiša**, o pats slaptažodis niekur neįrašomas.
- **El. pašto ar kitų asmens duomenų neprašoma.**
- Prisijungus naršyklė gauna atsitiktinį **sesijos žetoną**. DB saugoma tik jo maiša. Žetonas galioja 30 dienų nuo paskutinio apsilankymo, o „Atsijungti“ jį panaikina.
- **Vienas ryšys vienai paskyrai:** prisijungus kitame lange ar įrenginyje, senas langas atjungiamas ir parodo „Tęsti šiame lange“.
- **Apsauga nuo slaptažodžių spėliojimo:**
  - po 5 nesėkmingų bandymų tam pačiam slapyvardžiui iš to paties IP prisijungti galima tik po 10 min.;
  - iš vieno IP leidžiama ne daugiau kaip 30 nesėkmingų bandymų per 10 min.;
  - iš vieno IP galima sukurti iki 10 registracijų per valandą.
- Nauja paskyra gauna **10 000,00 €** žaidimo pinigų.
- Pamiršus slaptažodį jo atkurti negalima (el. pašto nėra). Administratorius gali tik atstatyti balansą, todėl tokiu atveju geriausia susikurti naują paskyrą.

**Administratorius (nebūtina).** Jei nustatytas aplinkos kintamasis `ADMIN_NICK=TavoSlapyvardis`, tas žaidėjas savo profilyje mato mygtuką „Atstatyti balansą (admin)“, kuriuo bet kurio žaidėjo balansą galima grąžinti į 10 000,00 €. ⚠️ Šį slapyvardį **užsiregistruok pats iš karto**, kad jo nepasiimtų kas nors kitas.

## 2. Paleidimas savo kompiuteryje (SQLite, nieko nustatinėti nereikia)

1. Įsidiek **Node.js 22.13 ar naujesnį** (geriausia 24 LTS): https://nodejs.org. Tada patikrink: `node -v`.
2. Išarchyvuok `kazino-multiplayer.zip` ir terminale nueik į aplanką:
   ```
   cd kazino-multiplayer
   npm install
   npm start
   ```
3. Naršyklėje atidaryk **http://localhost:3000** ir spausk „Registruotis“.

Duomenys automatiškai saugomi faile **`data/kazino.db`** (SQLite, įmontuota į Node.js). Serverį galima stabdyti (`Ctrl + C`) ir vėl paleisti, o balansai lieka. Norint pradėti viską iš naujo, sustabdyk serverį ir ištrink aplanką `data/`.

Kitas prievadas: `PORT=8080 npm start` (Windows PowerShell: `$env:PORT=8080; npm start`).

> Node 22 gali parodyti pranešimą „ExperimentalWarning: SQLite…“. Tai normalu, nes Node 22 SQLite modulį dar žymi kaip eksperimentinį.

### Žaidimas su draugais tame pačiame Wi‑Fi

1. Paleisk serverį (`npm start`).
2. Sužinok kompiuterio vietinį IP adresą:
   - Windows: `ipconfig`, žiūrėk „IPv4 Address“;
   - macOS: `ipconfig getifaddr en0`;
   - Linux: `hostname -I`.
3. Draugai atidaro `http://TAVO_IP:3000`, pvz. `http://192.168.1.23:3000`, ir susikuria savo paskyras.
4. Jei neprisijungia, leisk Node.js per užkardą (Windows: „Private networks“).

## 3. Nemokamai internete: Render (Web Service) + Neon (PostgreSQL)

Nemokamas Render serveris po maždaug 15 min. be lankytojų **užmiega**, o užmigęs jo diskas išsivalo. Todėl balansus laikome išorinėje nemokamoje **Neon PostgreSQL** duomenų bazėje: serveris gali miegoti ar persikrauti, o balansai lieka Neon.

> Kodėl ne Render Postgres? Render nemokama PostgreSQL duomenų bazė **nustoja veikti po 30 dienų**, jei jos neperkeli į mokamą planą. Neon nemokamas planas tokio termino neturi, todėl rekomenduojame jį.

### 3.1. Neon duomenų bazė

1. Atsidaryk https://neon.tech, spausk **Sign up** (galima per GitHub arba Google).
2. Spausk **Create project**:
   - **Project name:** `kazino`;
   - **Postgres version:** palik numatytąją;
   - **Region:** pasirink artimiausią, pvz. *AWS Europe Central (Frankfurt)*;
   - spausk **Create**.
3. Projekto skydelyje spausk **Connect**. Pasirinktos turi būti šaka `main` ir duomenų bazė `neondb`.
4. Nukopijuok **connection string**. Jis atrodo maždaug taip:
   ```
   postgresql://neondb_owner:SLAPTAŽODIS@ep-xxxx-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   ⚠️ Šioje eilutėje yra slaptažodis. Nedėk jos į GitHub ir niekam nesiųsk.

Lentelių kurti nereikia: serveris jas susikuria pats pirmo paleidimo metu.

### 3.2. Kodas į GitHub

1. Susikurk naują repozitoriją https://github.com (gali būti *Private*), pvz. `kazino-multiplayer`.
2. Įkelk visus aplanko failus, išskyrus `node_modules` ir `data`. Juos ir taip praleidžia `.gitignore`.
   ```
   git init
   git add .
   git commit -m "Kazino"
   git branch -M main
   git remote add origin https://github.com/TAVO_VARDAS/kazino-multiplayer.git
   git push -u origin main
   ```

### 3.3. Render Web Service

1. Atsidaryk https://render.com ir prisijunk su GitHub.
2. Spausk **New + → Web Service** ir pasirink savo repozitoriją.
3. Nustatymai:
   - **Language:** Node;
   - **Build Command:** `npm install`;
   - **Start Command:** `npm start`;
   - **Instance Type:** **Free**.
4. Skiltyje **Environment Variables** spausk **Add Environment Variable** ir pridėk:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string iš 3.1 žingsnio |
   | `NODE_VERSION` | `24` |
   | `TRUST_PROXY` | `1` |
   | `ADMIN_NICK` | (nebūtina) tavo slapyvardis |

5. Spausk **Create Web Service**. Po kelių minučių gausi adresą, pvz. `https://kazino-multiplayer.onrender.com`, kurį gali siųsti draugams.
6. Patikrinimas: atidaryk `https://…onrender.com/health`. Turi matyti `"db":"pg"`. Jei matai `"sqlite"`, vadinasi, `DATABASE_URL` nenustatytas, o balansai dings, kai serveris užmigs.

Alternatyva: repozitorijoje yra `render.yaml`, todėl galima rinktis **New + → Blueprint**. Render pats paprašys įvesti `DATABASE_URL` ir `ADMIN_NICK` reikšmes.

**Ką reiškia nemokamas planas:**
- Užmigus pirmas atidarymas užtrunka apie 30–60 s. Žaidėjai pamato „Jungiamasi…“, o paskui viskas veikia.
- **Balansai, paskyros ir statistika išlieka** Neon duomenų bazėje.
- Jei serveris išsijungia vykstant raundui, to raundo statymai **grąžinami** žaidėjams kito paleidimo metu. Pinigai niekada nedingsta ir nepasidaugina.
- Pokalbio istorija saugoma tik atmintyje ir užmigus išsivalo.

## 4. Aplinkos kintamieji

| Kintamasis | Numatyta | Paskirtis |
|---|---|---|
| `DATABASE_URL` | – | PostgreSQL adresas. Jei jo nėra, naudojama SQLite. |
| `KAZINO_DB` | `data/kazino.db` | SQLite failo kelias |
| `PORT` | `3000` | prievadas |
| `ADMIN_NICK` | – | administratoriaus slapyvardis (balanso atstatymui) |
| `TRUST_PROXY` | – (Render: įjungta) | `1`: kliento IP imamas iš `X-Forwarded-For` (reikia už proxy, pvz. Render) |
| `KAZINO_LOGIN_LIMIT` | `5` | nesėkmingi bandymai per 10 min. vienam slapyvardžiui iš vieno IP |
| `KAZINO_REG_LIMIT` | `10` | registracijos per valandą iš vieno IP |
| `KAZINO_TIME_SCALE` | `1` | laiko greitinimas testams (pvz. `0.05`) |

## 5. Kaip saugomi pinigai

- Visos sumos saugomos **centais** (sveikais skaičiais), todėl apvalinimo klaidų nėra.
- **Statymo metu:** viena DB transakcija nurašo sumą iš balanso ir įrašo statymą į lentelę `open_bets`.
- **Raundo pabaigoje:** viena transakcija įskaito išmokas, atnaujina statistiką ir ištrina raundo `open_bets`.
- **Paleidžiant serverį:** visi likę `open_bets` (nebaigti raundai) grąžinami žaidėjams.
- Atsakymas naršyklei siunčiamas tik tada, kai DB įrašas baigtas.
- Visus rezultatus (kortas, ruletę, ratą, kauliukus) nustato tik serveris (`crypto` atsitiktiniai skaičiai). Naršyklė tik rodo animaciją.

## 6. Failų žemėlapis: kur ką keisti

```
kazino-multiplayer/
├── server.js            Express + Socket.IO: registracija, prisijungimas, sesijos, visi žaidimų įvykiai
├── package.json         priklausomybės ir komandos (npm start, npm test)
├── render.yaml          Render.com nustatymai (Blueprint)
├── data/kazino.db       SQLite duomenų bazė (atsiranda pati; į ZIP/GitHub nededama)
├── src/
│   ├── db.js            duomenų bazė: SQLite arba PostgreSQL, lentelės, transakcijos
│   ├── auth.js          slapyvardžio taisyklės, slaptažodžių maiša (scrypt), žetonai, bandymų ribojimas, avatarai
│   ├── casino.js        bendras kazino: žaidėjai, balansai, Blackjack stalai, lyderiai, pokalbis
│   ├── money.js         pradinis balansas (START_BALANCE), papildymo riba (TOPUP_MAX)
│   ├── rng.js           atsitiktiniai skaičiai (crypto)
│   ├── table.js         bendra raundų logika: statymų laikas, „Pasiruošęs“, kartoti/išvalyti
│   ├── blackjack.js     Blackjack taisyklės, šalutiniai statymai, ėjimo laikas (TURN_MS)
│   ├── roulette.js      ruletės statymai ir išmokos
│   ├── wheel.js         Laimės rato segmentai, daugikliai, premijos, RTP
│   └── solo.js          Kauliukai ir Automatas
├── public/
│   ├── index.html       puslapio struktūra, taisyklių tekstai
│   ├── style.css        išvaizda (spalvos: :root kintamieji viršuje)
│   └── app.js           naršyklės logika, animacijos, žetonų reikšmės
└── test/test.js         automatinis testas (npm test)
```

Dažniausi pakeitimai:
- **Pradinis balansas:** `src/money.js`, `START_BALANCE` (centais: 1000000 = 10 000,00 €).
- **Vietų prie Blackjack stalo:** `src/casino.js`, `BJ_SEATS`.
- **Statymų laikas:** `super(room, ..., 20000)` klasių konstruktoriuose (`src/blackjack.js`, `src/roulette.js`, `src/wheel.js`), milisekundėmis.
- **Avatarai:** `src/auth.js`, `AVATARS`.
- **Žetonų reikšmės:** `public/app.js`, `CHIPS`.

## 7. Testas

```
npm test
```

Testas paleidžia serverį su laikina SQLite duomenų baze, prijungia virtualius žaidėjus ir patikrina:
- registraciją, prisijungimą, pasikartojantį slapyvardį, blogą slaptažodį ir bandymų ribą;
- sesijos atkūrimą ir seno lango išmetimą;
- visus žaidimus ir kelis Blackjack stalus vienu metu;
- **serverio nužudymą (`kill -9`) vykstant raundams:** po perkrovimo balansai turi išlikti, o atviri statymai turi būti grąžinti.

Su PostgreSQL: `DATABASE_URL=postgres://… npm test`. ⚠️ Testas **ištrina lenteles** toje duomenų bazėje, todėl naudok tik tuščią testinę bazę, ne tikrąją.

## 8. Apribojimai

- Vienas serverio procesas: kelių serverių vienu metu (horizontalaus mastelio) nėra.
- Pokalbis ir bandymų ribojimo skaitikliai laikomi atmintyje ir perkrovus išsivalo.
- Jei serveris nukrenta raundo viduryje, raundas **neišmokamas**: statymai grąžinami.
- Slaptažodžio atkūrimo nėra (nėra el. pašto).
- Tai pramoga: žaidimo pinigai, ne tikri. Nėra jokių tikrų pinigų, prizų ar mokėjimų.
