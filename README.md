# 🎈 VOCO viktoriin

Reaalajas töötav interaktiivne klassiruumi ja ürituste viktoriinimäng (Kahooti stiilis), kus küsimused ja edetabel kuvatakse suurel teleriekraanil ning osalejad vastavad oma nutitelefonis või arvutis.

Rakendus on ehitatud puhta PHP, SQLite'i ja vanilla JavaScriptiga — ühtegi välist teeki, raamistikku ega Node'i ehitussammu pole vaja.

---

## ✨ Peamised võimalused

- **Kolm vaadet ühes süsteemis:**
  - 📱 **Mängija vaade (`index.php`)** – liitumine üksi või tiimina, avatari valik ja küsimustele vastamine.
  - 📺 **Teleriekraan (`tv.php`)** – automaatne QR-koodiga ootesaal, animeeritud küsimused, taimer, heliefektid (Web Audio API) ja poodiumiga edetabel.
  - 🛠️ **Adminpaneel (`admin.php`)** – mängu reaalajas juhtimine, küsimuste haldus, JSON-import/eksport, osalejate haldus ja kujunduse seadistamine.
- **7 erinevat vastamisviisi:**
  - 🎯 **Klassika** – valikvastustega küsimus (2–6 varianti).
  - 🧺 **Püüdmine** – liiguta korvi ja püüa langevate vastuste seast õige kinni.
  - 🎈 **Õhupallid** – löö lõhki õige vastusega lendav õhupall.
  - 👍 **Õige või vale** – kiire tõese või väära väite valimine.
  - 🎚️ **Arvamismäng** – täpse väärtuse pakkumine liuguriga (ka lähedased vastused annavad punkte).
  - 🔢 **Järjestamine** – vastusevariantide puudutamine õiges järjekorras.
  - ⌨️ **Kirjuta ise** – vabatekstiline vastus (tõstutundetu, täpitähed normaliseeritakse automaatselt).
- **Punktiarvestus ja boonused:** kiirem vastus annab rohkem punkte ning järjestikused õiged vastused (🔥 *streak*) kasvatavad lisaboonust.
- **Kujunduse teemad ja oma CSS:** sisseehitatud teemad (`default`, `dark`, `neon`, `school`) ning reaalajas rakenduv kohandatud CSS otse adminpaneelist.
- **Kaasas näidisküsimused:** esmakordsel käivitamisel luuakse SQLite'i andmebaas automaatselt koos 13 eestikeelse näidisküsimusega.

---

## 📁 Projekti struktuur

```text
.
├── index.php          # Mängija vaade (nutitelefonis või arvutis osalemiseks)
├── tv.php             # Suure ekraani / projektori vaade
├── admin.php          # Õpetaja / mängujuhi halduspaneel
├── api.php            # JSON API lõpp-punkt (olek, liitumine, vastamine, haldus)
├── inc/
│   ├── config.php     # Põhiseaded (adminparool, andmebaasi asukoht, ajavöönd)
│   ├── db.php         # SQLite'i ühendus, skeem, mängumootor ja äriloogika
│   └── .htaccess      # Keelab otsejuurdepääsu inc/ kaustale
├── assets/
│   ├── style.css      # Kogu rakenduse stiilid, animatsioonid ja teemad
│   ├── common.js      # Ühised abifunktsioonid, kella sünkroniseerimine ja helisüntees
│   ├── player.js      # Mängija liides ja minimängude loogika
│   ├── tv.js          # Teleriekraani esitlusloogika
│   └── admin.js       # Adminpaneeli loogika
└── data/
    └── .htaccess      # Kaitseb SQLite'i andmebaasi avaliku allalaadimise eest
```

---

## 🚀 Paigaldamine ja käivitamine

### Nõuded serverile

- **PHP 7.4+** või **PHP 8.x**
- PHP laiendus **`pdo_sqlite`** (ja soovitatavalt `mbstring`)
- Kirjutamisõigus kaustale `data/` (kuhu luuakse `viktoriin.sqlite`)

### 1. Kohalik käivitamine (PHP sisseehitatud serveriga)

Klooni repositoorium ja käivita projekti juurkaustas PHP arendusserver:

```bash
git clone https://github.com/treumuth/game.git
cd game
php -S localhost:8000
```

Seejärel ava brauseris:

- **Mängija vaade:** [http://localhost:8000/](http://localhost:8000/)
- **Teleriekraan:** [http://localhost:8000/tv.php](http://localhost:8000/tv.php)
- **Adminpaneel:** [http://localhost:8000/admin.php](http://localhost:8000/admin.php)

### 2. Paigaldamine Apache / Nginx veebiserverisse

1. Kopeeri failid veebiserveri kausta (nt `/var/www/html/game`).
2. Veendu, et veebiserveril oleks kaustale `data/` kirjutamisõigus:
   ```bash
   chmod 775 data
   chown www-data:www-data data
   ```
3. Ava `inc/config.php` ja muuda vaikimisi adminparool:
   ```php
   define('ADMIN_PASSWORD', 'sinu-turvaline-parool');
   ```
4. Kui kasutad **Nginxi** (mis ei loe `.htaccess` faile), blokeeri kindlasti ligipääs kaustadele `/data/` ja `/inc/`:
   ```nginx
   location ~ ^/(data|inc)/ {
       deny all;
       return 403;
   }
   ```

---

## 🎮 Kuidas mängu läbi viia?

1. **Valmista küsimused ette:** logi sisse lehel `admin.php` (vaikimisi parool on määratud failis `inc/config.php`), kontrolli või lisa küsimused vahekaardil **„Küsimused“** ning seadista mängu nimi ja ajad vahekaardil **„Seaded“**.
2. **Ava teleriekraan:** ava `tv.php` projektoris või suurel ekraanil ja klõpsa **„Alusta“**, et lubada heliefektid ning täisekraanirežiim.
3. **Kutsu mängijad sisse:** osalejad skannivad teleriekraanil olevat QR-koodi või avavad mängu aadressi oma telefonis ning valivad nime ja avatari.
4. **Käivita mäng:** vajuta adminpaneelis **„Käivita mäng“**. Mäng liigub faaside kaupa automaatselt edasi (*tutvustus → küsimus → õige vastus → vahetabel*), kuid mängujuht saab igal hetkel vajutada ka **„Järgmine samm“**.

---

## 📦 Küsimuste import ja eksport (JSON)

Adminpaneelis saab küsimusi eksportida ja importida JSON-vormingus. Näide imporditavast failist:

```json
[
  {
    "mode": "classic",
    "text": "Mitu jalga on ämblikul? 🕷️",
    "options": ["6", "8", "10", "12"],
    "answer": 1,
    "time_limit": 20,
    "points": 1000,
    "active": 1
  },
  {
    "mode": "slider",
    "text": "Mis aastal taastas Eesti iseseisvuse? 🇪🇪",
    "answer": 1991,
    "extra": {
      "min": 1980,
      "max": 2000,
      "step": 1,
      "unit": "aastal",
      "tolerance": 0
    },
    "time_limit": 20,
    "points": 1000,
    "active": 1
  }
]
```

---

## 🔒 Turvalisus ja märkused enne avalikku kasutamist

- **Muuda adminparool:** failis `inc/config.php` on vaikimisi parool `voco2026`. Enne avalikku ülespanekut asenda see kindlasti uue parooliga.
- **Andmebaasi kaitse:** SQLite'i fail luuakse kausta `data/viktoriin.sqlite`. Apache serveris kaitseb seda `data/.htaccess`, ning `.gitignore` välistab `.sqlite` failide sattumise Git repositooriumisse.
