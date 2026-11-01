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
| 📦 Upgrader | dėžės, parduotuvė, inventorius | Originalūs skinai. Dėžių grąžinimas apie 90 %, pardavimas atgal 90 %, upgraderio tikimybė = įnašas / tikslas × 93 % (ribos 1–80 %) |
| 🚀 Crash | vienas bendras raundas visiems | Daugiklis kyla, kol nukrenta. Grąža apie **96,5 %**. Galima išeiti ranka arba nurodyti auto × |
| 💣 Mines | individualiai, 5×5 | Pasirenki 1–24 minas, atidarai langelius ir pasiimi kada nori. Daugiklis = 96,5 % / tikimybė išgyventi |
| 🟡 Plinko | individualiai | 8–16 eilučių, rizika maža / vidutinė / didelė. Binų daugikliai sunormuoti taip, kad grąža būtų apie **96,5 %** |
| 🪙 Moneta | dvikova su kitu žaidėju arba botu | Laimėtojas gauna **1,93×** statymą (96,5 %). Jei niekas neprisijungia per 30 s, stoja botas |
| 🥊 Dėžių kovos | 1v1, 1v1v1, 2v2 | Visi moka tą pačią dėžių kainą. Dėžės atsidaro vienu metu, didžiausia vertė pasiima visus skinus. Tuščias vietas užpildo botai |

Apačioje telefone: **Lobby**, **Žaidimai**, **Upgrader**, **Kovos**, **Profilis**. VIP, misijos ir turnyrai pasiekiami iš Lobby ir profilio. Balansas visada matomas viršuje. Sąsaja pritaikyta telefonui ir veikia plačiame ekrane.

Taip pat yra:
- bendras pokalbis;
- sąrašas „Dabar žaidžia“;
- **lyderių lentelė**: 10 turtingiausių žaidėjų iš duomenų bazės, įskaitant atsijungusius;
- profilis: avataras, sužaistų raundų skaičius, didžiausias laimėjimas, iš viso pastatyta;
- balanso papildymas žaidimo pinigais („Papildyti balansą“);
- **dienos dovana**: 1 000,00 € žaidimo pinigų kartą per UTC dieną (mygtukas profilyje);
- lygis, patirtis ir ženkliukai iš jau sukauptos statistikos;
- lyderiai pagal balansą, didžiausią laimėjimą ir skinų vertę;
- **Upgraderio** inventorius, dėžės, parduotuvė ir bendra skinų juosta.

---

## Upgrader (žaidimo pinigai)

Skyrius „Upgrader“ naudoja tuos pačius paskyrų balansus. **Skinų negalima iškeisti, išsiimti ar parduoti už tikrus pinigus.** Nėra mokėjimų, kortelių, banko ar prizų.

Skinų pavadinimai originalūs (pvz. „AK-47 | Žaibo audra“). Ginklo modelio vardas gali būti tikras (AK-47, M4A4, AWP, Karambitas…), apdailos vardas – mūsų. Paveikslėliai braižomi naršyklėje: siluetas pagal ginklo tipą, gradientas ir raštas pagal skiną, švytėjimas pagal retumą. Išorinių paveikslėlių nėra.

Retumo pakopos (spalvos kaip įprasta skinų svetainėse, bet pavadinimai lietuviški): Plataus vartojimo, Pramoninis, Kariuomenės, Riboto naudojimo, Slaptas, Klasifikuotas, Itin retas ★ (peiliai ir pirštinės). Būklė: Factory New, Minimal Wear, Field-Tested, Well-Worn, Battle-Scarred, su float reikšme. Variantas **Skaitiklis** yra retas priedas prie kai kurių skinų. Kiekvienas katalogo skinas turi fiksuotą žaidimo eurų vertę; dėžių kaina skaičiuojama iš šios vertės, kad teorinis grąžinimas būtų apie **90 %**.

Seni inventoriaus įrašai su žinomu `skin_id` lieka. Nežinomas identifikatorius, jei jis yra skaičius, perkeliamas į artimiausią katalogo skiną pagal vertę; kitu atveju – į pigiausią.

Kaip gauti skiną:

- **Dėžės** (Smėlio, Nakties, Perkūno, Karūnos). Kaina parinkta taip, kad teorinis grąžinimas būtų apie **90 %** (tikslus procentas rodomas prie dėžės). Iškritimą nustato serveris; juosta ekrane tik animacija. Visos tikimybės išvardytos.
- **Parduotuvė** parduoda bet kurį katalogo skiną už jo vertę.
- **Pardavimas** grąžina **90 %** vertės (centai apvalinami žemyn).

**Upgraderis.** Įdedi vieną ar kelis savo skinus ir, jei nori, dalį balanso. Pasirenki tikslo skiną ir pusę: „žemiau“ arba „virš“.

- Neapkarpyta tikimybė = `floor(įnašas × 9300 / tikslo vertė) / 10000`, tai yra įnašas / tikslas × **93 %** (namų dalis 7 %), apvalinta žemyn.
- Jei išeitų mažiau nei **1 %**, metimas atmetamas.
- Jei išeitų daugiau nei **80 %**, tikimybė nukerpama iki 80 % (tada grąža mažesnė nei 93 %).
- Serveris meta `crypto.randomInt(10000)`. „Žemiau“ laimi, kai metimas `< tikimybė`. „Virš“ laimi, kai metimas `≥ 10000 − tikimybė`.
- Laimėjus gauni tikslo skiną, pralaimėjus įnašas prarandamas.
- Viskas vienoje DB transakcijoje. Tas pats daiktas negali būti panaudotas du kartus.

Inventorius saugomas lentelėje `inventory`, įvykiai – `skin_events`. Senesnė duomenų bazė papildoma lentelėmis paleidžiant serverį (taip pat `holds`, `mission_progress`, `tournament_scores`, `tournament_paid`); **esami balansai neperrašomi**. Bendroje juostoje matyti paskutinės dėžės ir upgraderio metimai, profilyje – tavo istorija.

## Nauji žaidimai, kovos, VIP (žaidimo pinigai)

Visi nauji žaidimai skaičiuojami serveryje (`crypto` atsitiktinumas, centai). Pinigai lieka žaidimo pinigai.

- **Crash** – bendras raundas. Taškas skaičiuojamas iš serverio sėklos (HMAC), kurios SHA-256 maišas matomas prieš startą, o pati sėkla – po kritimo. Jei vienetinis metimas `< 3,5 %`, daugiklis 1,00×, kitaip `floor(0,965 / (1 − x) × 100)` šimtųjų, ribos 1,00×–1000×. Kreivė: `100 × e^(ln(1,055) / 90 × ms)`. Grąža apie **96,5 %**.
- **Būklė ir Skaitiklis.** Bazinė kaina yra Factory New be Skaitiklio. Daugikliai: FN 1,00, MW 0,85, FT 0,70, WW 0,62, BS 0,55. Skaitiklis (10 % tikimybė) ×1,50. Dėžių kaina iš naujo paskaičiuota, kad tikėtina grąža liktų apie **90 %**. Parduotuvė, upgraderis ir kovos naudoja šią būklės kainą. Seni daiktai perkeliami kaip FN be Skaitiklio už buvusią vertę.
- **Sąžiningumas.** Kiekvienas žaidėjas turi serverio sėklą (rodomas tik maišas), keičiamą kliento sėklą ir nonce. Metimas = `HMAC-SHA256(serverSeed, clientSeed:nonce:cursor)` pirmieji 4 baitai modulis n. Taip metami upgraderis, dėžės, Mines, Plinko ir moneta. Puslapis „Sąžiningumas“ profilyje leidžia atverti sėklą ir pasitikrinti seną metimą.
- **Mines** – 25 langeliai. Daugiklis po k saugų langelių yra `floor(0,965 / p × 100) / 100`, kur p – tikimybė tiek kartų iš eilės nepataikyti į miną.
- **Plinko** – kiekvienas kamuoliukas nepriklausomai krenta kairėn arba dešinėn. Daugikliai kraštuose didesni, o visa skalė padauginta taip, kad tikėtina grąža būtų apie **96,5 %** (dėl apvalinimo žemyn šiek tiek mažiau).
- **Moneta** – laimėtojas gauna `floor(2 × statymas × 965 / 1000)`, tai yra **1,93×** (96,5 %).
- **Dėžių kovos** – kaina lygi pasirinktų dėžių kainai. Serveris meta kiekvieną dėžę atskirai. Lygiosios skaidomos atsitiktinai. Laimėtojas gauna visus iškritusius skinus.
- **Turnyrai** – dienos Crash daugiklis (fondas 1 000 €), daugiausiai pastatyta (1 000 €), geriausias upgrade (800 €) ir savaitės Crash (4 000 €). Fondą sudeda namai, ne žaidėjai. Geriausi trys dalijasi 50 % / 30 % / 20 %. Išmoka įvyksta pasibaigus laikotarpiui (vidurnaktis **Europe/Vilnius**).
- **Misijos** – dienos ir savaitės užduotys (dėžės, upgrade, blackjack, Plinko, statymai, Crash išėmimai). Atlygis – žaidimo pinigai. Skaitiklis atsistato su nauju Vilniaus dienos arba savaitės raktu.
- **VIP** – patirtis = `floor(pastatyta / 100)`. Pakopos: Bronza, Sidabras, Auksas, Platina, Deimantas. Kuo aukščiau, tuo didesnė žaidimo pinigų grąža nuo statymų (0,2 %–1 %), didesnė dienos dovana ir (nuo Sidabro) viena nemokama VIP dėžė per Vilniaus dieną.

---

## 1. Paskyros ir slapyvardžiai

- **Slapyvardis:** 3–16 simbolių, tik raidės (galima ir lietuviškos), skaičiai ir `_`. Jis unikalus, o didžiosios ir mažosios raidės nesiskiria: jei yra `Dovis`, `dovis` užregistruoti nebegalima.
- **Slaptažodis:** 6–100 simbolių. Serveryje jis saugomas tik kaip **scrypt maiša**, o pats slaptažodis niekur neįrašomas.
- **El. pašto ar kitų asmens duomenų neprašoma.**
- Prisijungus naršyklė gauna atsitiktinį **sesijos žetoną**. DB saugoma tik jo maiša. Žetonas galioja 30 dienų nuo paskutinio apsilankymo, o „Atsijungti“ jį panaikina.
- **Vienas ryšys vienai paskyrai:** prisijungus kitame lange ar įrenginyje, senas langas atjungiamas ir parodo „Tęsti šiame lange“.
- **Apsauga nuo slaptažodžių spėliojimo:**
  - po 5 nesėkmingų bandymų tam pačiam slapyvardžiui iš to paties IP prisijungti galima tik po 10 min.;
  - iš vieno IP leidžiama bent 80 nesėkmingų bandymų per 10 min., kad vieno draugo klaidos neužrakintų viso Wi-Fi;
  - iš vieno IP galima sukurti iki **60** registracijų per valandą (draugai dažnai dalijasi vienu adresu). Daugiau: `KAZINO_REG_LIMIT`.
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
| `KAZINO_REG_LIMIT` | `60` | registracijos per valandą iš vieno IP |
| `KAZINO_TIME_SCALE` | `1` | laiko greitinimas testams (pvz. `0.05`) |

## 5. Kaip saugomi pinigai

- Visos sumos saugomos **centais** (sveikais skaičiais), todėl apvalinimo klaidų nėra.
- **Statymo metu:** viena DB transakcija nurašo sumą iš balanso ir įrašo statymą į lentelę `open_bets`.
- **Raundo pabaigoje:** viena transakcija įskaito išmokas, atnaujina statistiką ir ištrina raundo `open_bets`.
- **Paleidžiant serverį:** visi likę `open_bets` (nebaigti raundai) grąžinami žaidėjams. Dėžės, parduotuvė, pardavimas ir upgraderis nėra „atviri raundai“: jie arba įrašyti iki galo, arba (jei transakcija nutrūksta) neįrašyti visai, todėl daiktai ir balansas nepasidalina pusiau.
- **Inventorius** rašomas toje pačioje transakcijoje kaip balanso pokytis.
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
│   ├── solo.js          Kauliukai ir Automatas
│   ├── skins.js         skinų katalogas, dėžės, parduotuvė, upgraderio tikimybės
│   └── progress.js      lygis, patirtis, pasiekimai, dienos dovana
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
- **Skinų vertės, dėžių svoriai, upgraderio 93 % / 1–80 %:** `src/skins.js` (`KEEP_BP`, `MIN_BP`, `MAX_BP`, `SELL_NUM`).

## 7. Testas

```
npm test
```

Testas paleidžia serverį su laikina SQLite duomenų baze, prijungia virtualius žaidėjus ir patikrina:
- registraciją, prisijungimą, pasikartojantį slapyvardį, blogą slaptažodį ir bandymų ribą;
- sesijos atkūrimą ir seno lango išmetimą;
- visus žaidimus ir kelis Blackjack stalus vienu metu;
- dėžių, parduotuvės, pardavimo ir upgraderio tikimybes, laimėjimą/pralaimėjimą, balanso ir inventoriaus sutapimą, apsaugą nuo dvigubo to paties daikto panaudojimo;
- senos duomenų bazės migraciją (balansas išlieka, atsiranda `inventory` ir `skin_events`);
- **serverio nužudymą (`kill -9`) vykstant raundams:** po perkrovimo balansai turi išlikti, o atviri statymai turi būti grąžinti. Inventorius ir jau įrašytas balansas irgi išlieka.

Su PostgreSQL: `DATABASE_URL=postgres://… npm test`. ⚠️ Testas **ištrina lenteles** toje duomenų bazėje, todėl naudok tik tuščią testinę bazę, ne tikrąją.

Jei draugui „neveikia“:

- **Puslapis ilgai tuščias arba „Serveris bunda…“** – nemokamas Render po pauzės keliasi 30–60 s. Palauk, puslapis bando pats (`/health`).
- **Privatus „Safari“ langas** – jei naršyklė neleidžia `localStorage`, sesija galioja tik kol langas atidarytas. Parodomas pranešimas, programa nelūžta.
- **Keli draugai viename Wi-Fi** – anksčiau iš vieno IP buvo tik 10 registracijų per valandą. Dabar 60.
- Ryšys pirmiausia eina per **polling**, paskui per websocket, todėl veikia ir ten, kur websocket užblokuotas.

## 8. Apribojimai

- Vienas serverio procesas: kelių serverių vienu metu (horizontalaus mastelio) nėra.
- Pokalbis ir bandymų ribojimo skaitikliai laikomi atmintyje ir perkrovus išsivalo.
- Jei serveris nukrenta raundo viduryje, raundas **neišmokamas**: statymai grąžinami.
- Slaptažodžio atkūrimo nėra (nėra el. pašto).
- Tai pramoga: žaidimo pinigai, ne tikri. Nėra jokių tikrų pinigų, prizų ar mokėjimų.
