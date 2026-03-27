# Elekes Bálint e.v.

Webalapú fejlesztés & digitális megoldások  
info@balintelekes.hu  
+36 30 773 4662

Elekes Bálint e.v. | info@balintelekes.hu | +36 30 773 4662

---

# ÁRAJÁNLAT

**Mobilalkalmazás (iOS + Android) – AdriaGo / ENC platform**  
Egyedi fejlesztés – tervezés, fejlesztés, integráció a meglévő rendszerrel, tesztelés, store beküldés és utánkövetés

| | |
| --- | --- |
| **Dátum** | 2026 |
| **Megvalósítási idő** | 2–3 hónap |
| **Utánkövetés** | 6 hónap – ingyenes |

---

## 1. Az ajánlat tárgya

**Miért előnyös ez az ajánlat?** A webes rendszert is én készítettem, ezért a mobil app közvetlenül a meglévő architektúrára épül, és web + app együtt tud működni – ugyanaz az adatbázis, ugyanazok az admin beállítások, kevesebb félreértés és gyorsabb átadás.

Az Ajánlattevő ajánlatot tesz egy egyedi fejlesztésű, modern **iOS és Android alkalmazás** teljes körű megtervezésére, grafikai kialakítására, fejlesztésére, a meglévő webes backend (Supabase, Next.js API-k, Stripe webhookok) integrációjára, tesztelésére, App Store és Google Play beküldésére, valamint 6 hónapos ingyenes utánkövetésre.

Az alkalmazás célja:

- Ugyanazt az adatbázist és üzleti logikát használni, mint a web – az adminban módosított beállítások (pl. csomagárak, referral kedvezmény, egyenlegküszöbök) automatikusan tükröződnek az appban is
- Felhasználói fiók: bejelentkezés, profil, eszközök, egyenlegek, tranzakciók / útvonal előzmények
- Egyenlegfeltöltés és készülékvásárlás Stripe-on keresztül, a meglévő szerveroldali folyamatokkal összhangban
- Referral / meghívó funkció a webes API-khoz igazítva
- Boltba beküldhető build-ek (belső teszt / TestFlight, majd éles)

Az alkalmazás 100%-ban egyedi kódra épül. A React Native (Expo) + TypeScript technológia illeszkedik a meglévő TypeScript / Supabase környezethez, és hosszú távon fenntartható.

---

## 2. Időtartam

A projekt tervezett megvalósítási ideje az ajánlat elfogadásától számított kb. **2–3 hónap** (a pontos scope és egyeztetések függvényében).

| Fázis | Tartalom |
| --- | --- |
| Specifikáció | Képernyők, user flow-k, Stripe stratégia mobilra (hosted checkout vs. Payment Sheet), jogosultságok, mélylinkek |
| Grafikai / UX/UI tervezés | Mobil-first képernyők, navigáció, komponensrendszer, ENC márkához igazítás |
| Fejlesztés | Auth, profil, dashboard, topup, eszközrendelés, referral, integrációs hívások |
| Integrációk | Supabase Auth, meglévő API route-ok, Stripe, opcionális push / analytics |
| Tesztelés & finomhangolás | Funkcionális teszt, fizetési sandbox, készülékteszt (iOS + Android) |
| Store & élesítés | Build, App Store Connect + Google Play Console, átadás, rövid betanítás |

---

## 3. Díjazás

**Teljes projektdíj: Bruttó ? Ft**

Tartalmazza: tervezés · fejlesztés · tesztelés · store beküldés (iOS + Android) · betanítás · 6 hónap utánkövetés

### 3.1 Fizetési ütemezés

| Részlet | Összeg | Feltétel |
| --- | --- | --- |
| 1. részlet | 20% – Bruttó ? Ft | Az ajánlat elfogadásakor, szerződéskötéskor, előlegszámla alapján. *(A konkrét Ft összeg a végleges bruttó projektdíj 20%-a.)* |
| 2. részlet | 80% – Bruttó ? Ft | A Megrendelő a teszt buildben (TestFlight / Android belső teszt) kipróbálja és késznek nyilvánítja az alkalmazást. Teljes fizetés után átadásra kerül a forráskód, a hozzáférések és a dokumentáció. *(A konkrét Ft összeg a végleges bruttó projektdíj 80%-a.)* |

Amennyiben a fenti ütemezés nem megfelelő, egyéni fizetési ütemezés is megbeszélhető.

### 3.2 Ajándék fejlesztői keret

🎁 **+5 óra ingyenes fejlesztői keret**  
Az ajánlat elfogadásától számított 1 hónapon belül felhasználható kisebb igényekre, finomhangolásokra, tartalmi módosításokra.

---

## 4. A szolgáltatás tartalma

### 4.1 Grafikai és UX/UI tervezés

- Egyedi mobil UI az ENC / AdriaGo arculathoz igazítva
- Fő képernyők: bejelentkezés, dashboard, eszközök, egyenleg, rendelés / feltöltés
- Egységes design system (színek, tipográfia, gombok, hibák / loading állapotok)
- iOS és Android UX szokások figyelembevétele

### 4.2 Alkalmazásfejlesztés (React Native / Expo / TypeScript)

- Navigáció, űrlapok, validáció, hibakezelés
- Státuszok és összegek megjelenítése (admin settings alapján)
- Referral flow a meglévő API-kkal

### 4.3 Backend és adat (meglévő rendszer integráció)

- Közös Supabase adatbázis és meglévő üzleti szabályok
- Autentikáció: Supabase Auth (a webes fiókkal kompatibilisen)
- REST hívások a meglévő Next.js API végpontok felé, ahol szükséges

### 4.4 Funkciók (MVP – első szállítás)

| Modul | Funkciók |
| --- | --- |
| Auth | Regisztráció, bejelentkezés, jelszó visszaállítás |
| Profil | Számlázási / szállítási adatok (a webes profillal összhangban) |
| Dashboard | Eszközök, státuszok, wallet összefoglaló |
| Egyenlegfeltöltés | Csomagválasztás, Stripe indítás, visszajelzés |
| Készülék vásárlás | Kategória, rendszám, szerződés elfogadás, Stripe |
| Referral | Meghívó küldés / státusz (API-k szerint) |

*Az admin teljes körű kezelése mobilról és az MPL címke teljes folyamata mobil UI-ban nem része az MVP-nek; külön igényként egyeztethető.*

### 4.5 Integrációk

- Stripe – a webes checkout / webhook logikával összhangban
- Supabase – auth és adatolvasás jogosultsági szintek szerint
- Opcionális: push értesítések, analytics, mélylinkek

---

## 5. Technológiai megvalósítás

| Réteg | Technológia | Megjegyzés |
| --- | --- | --- |
| Mobil app | React Native (Expo) + TypeScript | Egy kódbázis, iOS + Android |
| Stílusok | Natív stílus / design system | Platform-specifikus finomhangolás |
| Backend | Meglévő Next.js API + Supabase | Nincs párhuzamos „másik backend” |
| Adatbázis | PostgreSQL (Supabase) | Közös a weboldallal |
| Autentikáció | Supabase Auth | JWT / session kezelés |
| Fizetés | Stripe | Webhookok változatlanul a szerveren |
| Store | EAS Build / App Store + Play | Build pipeline és beküldés |

---

## 6. Biztonság és megfelelőség

- HTTPS minden API-hívásnál
- Biztonságos token / session tárolás mobil best practice szerint
- Érzékeny titkok nem kerülnek az appba hardcode-olva
- Rate limiting a kritikus végpontokon (ahol a backend már alkalmazza)
- Adatvédelem / ÁSZF: a webes oldalakra mutató linkek és elfogadások támogatása

---

## 7. Óradíjas többletmunkák

A projekt átadása után felmerülő, az eredeti specifikáción túlmutató fejlesztési igények óradíjas alapon végezhetők el.

**Bruttó óradíj: 12 000 Ft / óra**

Az ajándék +5 óra fejlesztői keret az elfogadástól számított 1 hónapon belül díjmentesen használható fel; ezt követően a fenti óradíj érvényes.

---

## 8. Átadás, dokumentáció és utánkövetés

- Git repository (GitHub): a mobil forráskód admin joggal átadva
- Technikai dokumentáció: build, környezetek, store fiókokhoz szükséges checklist
- Rövid használati útmutató a fő folyamatokról
- Átadás: belső teszt → store review → éles
- Képzés: 1–2 órás online bemutató

### 8.1 Utánkövetés – 6 hónap (ingyenes)

- Hibajavítások: technikai problémák, bugok kezelése
- Tanácsadás: kérdések megválaszolása a rendszer használatával kapcsolatban
- +5 óra ingyenes fejlesztői keret az elfogadást követő 1 hónapban

---

## 9. Üzemeltetés – várható havi költségek

Fix, magas havi fejlesztői üzemeltetési díj nem része ennek az ajánlatnak.

| Tétel | Díj / megjegyzés |
| --- | --- |
| Apple Developer Program | Éves díj (Megrendelő fiókjában) |
| Google Play Console | Egyszeri / éves díj (szolgáltató szerint) |
| Supabase | Meglévő csomag szerint |
| Stripe | Tranzakciós díjak |
| E-mail (Resend stb.) | Meglévő csomag szerint |
| Összesített becslés | A fenti tételek a Megrendelő meglévő szerződései szerint; fejlesztői oldalról nincs kötelező havi díj |

---

## 10. Összefoglalás és ajándékok

Mit tartalmaz az ajánlat?

- ✔ Teljes grafikai és UX/UI tervezés (mobil)
- ✔ Egyedi iOS + Android alkalmazás (egy kódbázis)
- ✔ Integráció a meglévő Supabase + API + Stripe rendszerrel
- ✔ Tesztelés és store beküldés (mindkét platform)
- ✔ Betanítás és dokumentáció
- ✔ 6 hónap ingyenes utánkövetés
- ✔ +5 óra ingyenes fejlesztői keret (1 hónapon belül)

**Teljes projektdíj: Bruttó ? Ft**

---

## 11. Miért válasszon minket?

| Szempont | Egyedi mobil fejlesztés – Elekes Bálint e.v. | Sablon / no-code app builder |
| --- | --- | --- |
| Technológia | React Native + TypeScript, karbantartható kód | Korlátozott testreszabás, vendor lock-in |
| Integráció | Közvetlen illeszkedés a meglévő backendhez | Nehéz vagy drága egyedi API integráció |
| Web + app összhang | Egy kézben: ugyanaz a fejlesztő, aki a webet is építette | Gyakran két csapat, két „igazság” |
| Teljesítmény | Natív build, optimalizált navigáció | Extra rétegek, lassabb frissítés |
| Skálázhatóság | Bármilyen új modul felépíthető | A platform korlátai |
| Tulajdonlás | Forráskód az Ön kezében (Git) | Gyakran zárt rendszer |
| Utánkövetés | 6 hónap ingyenes support | Gyakran fizetős vagy hiányos |

Köszönöm a bizalmat! Bármilyen kérdés esetén állok rendelkezésre.

**info@balintelekes.hu | +36 30 773 4662**
