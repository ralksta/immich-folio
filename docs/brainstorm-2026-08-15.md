# Feature-Brainstorm: Kundengeschäft, Handwerk, Vertrauen

_Stand: 2026-08-15 · Basis: v0.11.0 (dev, nach #431 und #460) · Fokus: was ein
Fotograf im Alltag mit dieser Software tut_

Dieses Dokument ergänzt [`ideas.md`](ideas.md) (Präsentation),
[`brainstorm.md`](brainstorm.md) (Mai 2026) und
[`brainstorm-2026-08-05.md`](brainstorm-2026-08-05.md) (Verbreitung & Betrieb).
Es wiederholt deren Ideen **nicht**. Wo es einen bereits gelisteten Punkt aufgreift,
steht es ausdrücklich dabei (Abschnitt D).

Die Perspektive hier ist eine andere als in den Vorgängern: nicht „was fehlt der
Software", sondern **„was tut ein Fotograf, das Folio heute nicht begleitet"** —
Bilder an Kunden übergeben, eine Serie sequenzieren, entscheiden, was die Welt über
den Aufnahmeort erfahren darf.

Alle Befunde sind gegen den Code-Stand geprüft; Aufwand: XS (Stunden), S (1 Tag),
M (2–5 Tage), L (Wochen).

---

## Was seit den alten Listen dazugekommen ist

Damit klar ist, warum die folgenden Ideen neu sind: seit #431 und #460 leben bereits
Fokuspunkt fürs Cover, Bildunterschriften aus der Immich-Description,
`justified`-Layout, unlisted Subpages, externe Nav-Links, Cover-Splash-Hero und
per-Album-Grid. Früher kamen Wasserzeichen, Rechtsklick-Schutz, Client-Proofing
inklusive Share-Link und Mailto-Export, Map, Video, Journal/Essays, Setup-Assistent,
Error-Boundaries und der Stale-Cache dazu.

Weiterhin offen aus den alten Listen und hier bewusst _nicht_ nochmal ausgeführt:
Slideshow, Fullscreen, Download-Button, Copy-Link, Photo of the Day, ISR,
EXIF-Statistikseite, Before/After-Slider, i18n, Timeline, Smart Search, PWA,
Demo-Modus, Config-Doctor, Platten-Cache, Metriken, Multi-Site.

---

## A. Kundengeschäft

Folio kann Kunden heute Bilder _zeigen_ (Passwort, Proofing) — aber der Weg
davor und danach fehlt: wie der Kunde hereinkommt und wie er sich zurückmeldet.

### A1. Ablaufende, widerrufbare Client-Links — **M, hoher Impact**

**Befund:** Kundenzugang ist heute ein statisches Passwort in `gallery.yaml`, geprüft
gegen ein HMAC-Cookie (`lib/auth.ts:44-46`, `lb_auth_album_<slug>`). Daraus folgt
dreierlei: Das Passwort läuft nie ab. Es lässt sich nicht für _einen_ Empfänger
zurückziehen, sondern nur für alle gleichzeitig ändern. Und der Kunde muss es tippen —
in der Praxis steht es deshalb ohnehin in derselben Mail wie der Link, was die
Zugangskontrolle auf ein Feigenblatt reduziert.

**Idee:** Zugangs-Links, die im Admin erzeugt werden:

```
https://folio.example/hochzeit-mueller?k=<signiertes-token>
```

Das Token trägt Slug, Ablaufdatum und eine Link-ID; signiert mit derselben Mechanik
wie die Admin-Session (`lib/admin/auth.ts`). Beim ersten Aufruf wird es gegen genau
das Cookie eingetauscht, das heute schon existiert — der gesamte Rest der
Zugangsprüfung bleibt unangetastet. Im Admin: eine Liste mit Label („Brautpaar",
„Location"), Ablaufdatum und einem Widerrufen-Knopf.

**Warum das zieht:** Es ist der Unterschied zwischen „hier ist ein Passwort" und dem,
was Kunden von Pixieset oder Pic-Time kennen. Für Hochzeits- und Auftragsfotografen
ist die Galerie-Übergabe der eigentliche Arbeitsschritt, nicht das Portfolio.

**Zwei Trade-offs, die benannt gehören:**

- **Widerruf braucht Zustand.** Ein rein signiertes Token kann man nicht
  zurücknehmen, nur ablaufen lassen. Echter Widerruf verlangt eine Liste ausgegebener
  Link-IDs in `content/` — sonst ist das Wort „widerrufbar" gelogen. Das ist der
  erste Fall, in dem Folio Besucher-bezogenen Zustand speichert; die Liste sollte
  entsprechend klein und selbstaufräumend sein.
- **Bild-URLs bleiben unberührt.** Asset-Tokens sind bewusst deterministisch, damit
  Browser cachen können. Ein widerrufener Zugang macht bereits ausgelieferte
  Bild-URLs also nicht ungültig — derselbe Trade-off, der in
  [`deep-dive-2026-08-05.md`](deep-dive-2026-08-05.md) für die Allowlist notiert ist.
  Er muss hier _dokumentiert_ werden, sonst erwartet jemand mehr, als das Feature hält.

---

### A2. Anfrage-Formular statt `mailto:` — **S–M**

**Befund:** Es gibt kein Formular. Kontakt läuft über `mailto:` im Footer
(`components/Footer.tsx:60`) und im Proofing-Modal
(`components/ProofingModal.tsx:43`). Das hat zwei Kosten, die Fotografen real treffen:
Die Adresse steht im Klartext im HTML und wird abgegrast, und auf Geräten ohne
konfigurierten Mail-Client passiert beim Klick schlicht nichts — der Kunde denkt, der
Link sei kaputt.

**Idee:** Eine rate-limitierte Route (`lib/rate-limit.ts` ist da, eigener Namensraum
`contact:`, niedriges Limit in der Größenordnung der Auth-Routen) plus Honeypot-Feld.
Zustellung wahlweise per SMTP oder per Webhook. Und — das ist der eigentliche Wert —
ein **„Zu diesem Bild anfragen"** direkt im Lightbox: Print-Anfrage, Lizenzanfrage,
Buchung, mit Bildreferenz vorausgefüllt. Aus einer Galerie wird damit ein
Verkaufskanal, ohne dass ein Shop dranhängt.

**Ehrlich zu benennen:** SMTP wäre die erste ausgehende Verbindung des Projekts
überhaupt und die erste ernsthafte neue Dependency (das Projekt hat heute sieben
Runtime-Dependencies und keine Mail-Bibliothek). Der Webhook-Weg vermeidet beides und
passt besser zur bestehenden Linie — `POST /api/webhook` zeigt, dass das Muster im
Haus schon verstanden ist. **Empfehlung: mit Webhook anfangen, SMTP optional
nachziehen.**

---

### A3. Proofing v2 — Notizen statt nur Herzen — **S**

**Befund:** Die Auswahl ist eine Bitmaske von Indizes (`lib/proofing.ts`), exportiert
als Link, als nummerierte Liste oder per Mailto. Sie transportiert also genau ein Bit
pro Foto: gewählt oder nicht.

**Idee:** Ein kurzes Notizfeld pro ausgewähltem Foto. Kunden sagen selten nur „dieses",
sondern „dieses, aber enger geschnitten" oder „das für die Danksagung". Heute landet
das in einer separaten Mail mit Bildnummern, die der Fotograf von Hand zuordnet — der
unangenehmste Teil des ganzen Ablaufs.

**Der Trade-off ist hier die eigentliche Designfrage:** Freitext passt nicht in eine
Bitmaske im URL-Parameter. Zwei saubere Auswege:

- **Klein:** Notizen bleiben in `localStorage` und wandern nur in den Export-Text.
  Der Share-Link trägt weiterhin nur die Auswahl. Kein Server, kein neuer Zustand —
  passt exakt zur heutigen Architektur („nichts wird serverseitig gespeichert").
- **Groß:** Ein Endpunkt, der die Auswahl entgegennimmt. Das wäre der erste
  Schreibzugriff durch Besucher — mit allem, was daran hängt: Rate-Limiting,
  Größenbegrenzung, Spam, Aufbewahrung. Nur sinnvoll zusammen mit A1, weil erst ein
  identifizierbarer Client-Link die Rückmeldung zuordenbar macht.

**Empfehlung:** die kleine Variante. Sie kostet einen Tag und löst 90 % des Problems.

---

## B. Handwerk & Präsentation

Die Zielgruppe sind laut den bisherigen Doks „Fotografen mit Gestaltungsanspruch".
Die drei folgenden Punkte zielen genau darauf — und einer davon ist ein Befund, der
mich beim Lesen überrascht hat.

### B1. Sequenzierung wie im Fotobuch — **M, der stärkste Differenzierer hier**

**Befund:** Ein Layout gilt für ein ganzes Album (`grid.layout`, seit #431 auch pro
Album überschreibbar). Die Reihenfolge ist frei wählbar (`assetOrder`,
`lib/config/schema.ts:224`, mit Drag & Drop im Admin) — aber jedes Foto bekommt
dieselbe Behandlung wie sein Nachbar.

Ein Fotobuch funktioniert anders. Es lebt von **Paaren**, die sich auf einer
Doppelseite antworten, von **einem Bild, das allein über die volle Breite geht**, und
von **Pausen**. Genau diese Mittel besitzt die Essay-Ansicht bereits — die
Journal-Syntax kennt `fullbleed`, `wide` und Foto-Paare (`lib/journal.ts`). Das Album
kennt sie nicht.

**Idee:** Optionale Layout-Hinweise entlang des vorhandenen `assetOrder`:

```yaml
- 'album-uuid':
    sort: manual
    assetOrder:
      - 'asset-opening': fullbleed # allein, volle Breite
      - 'asset-a': pair # diese beiden nebeneinander,
      - 'asset-b': pair #   in gleicher Höhe
      - 'asset-c'
      - break # bewusste Lücke, dann geht es weiter
```

Renderer-seitig ist das kein neues Layout-System, sondern eine Segmentierung des
bestehenden Grids: `PhotoGrid` gruppiert die Assets vor dem Rendern in Blöcke und
rendert je Block das passende Muster. Die Bausteine — Aspect-Ratio pro Asset
(`assetAspectRatio`), Zeilenmathematik aus `justified` — liegen schon da.

**Warum das zieht:** Es ist das einzige Feature auf dieser Liste, das kein anderes
Immich-Portfolio-Tool hat, und es spricht die Zielgruppe an ihrer empfindlichsten
Stelle an: Reihenfolge ist Handwerk. Eine Serie, die als gleichförmiges Raster
ausgespielt wird, ist eine Serie, deren Rhythmus verloren geht.

**Trade-off:** Das Feature ist im Admin nur so gut wie seine Vorschau. Layout-Hinweise
in einer Liste zu setzen, ohne das Ergebnis zu sehen, ist frustrierend — der
`AssetOrderEditor` müsste die Blöcke andeuten. Das ist die halbe Arbeit an dieser
Idee, nicht das YAML-Schema.

---

### B2. 1:1-Zoom im Lightbox — **S** _(mit einem Nebenbefund)_

**Befund — und der ist präziser, als er zunächst aussieht:** Der Lightbox hat keinerlei
Zoom; die einzige Transformation ist eine Mount-Transition von `scale(0.96)` auf `1`
(`components/Lightbox.module.css`). So weit erwartbar.

Interessanter ist, _was_ er anzeigt. Der Dateikopf verspricht
„Full-resolution image display" (`components/Lightbox.tsx:5`), gerendert wird aber
`current.previewUrl` (`components/Lightbox.tsx:237`). Und `imageUrl()` steht per
Default auf `'preview'` (`lib/urls.ts:29`) — eine Suche über `app/`, `components/`
und `lib/urls.ts` findet **keine einzige Stelle, die `'original'` anfordert**. Die
oberste Größenstufe aus `lib/imageSize.ts` ist im gesamten Frontend unerreichbar.

Das ist als Default vollkommen richtig — Originale an jeden Besucher auszuliefern wäre
verschwenderisch, und `resolveImageSize()` verhindert das aus gutem Grund. Aber es
heißt: Der Lightbox zeigt heute Immichs Preview, nicht die Aufnahme. Wer Schärfe
beurteilen will — der Fotograf selbst, und jeder Kunde, der bei der Auswahl auf den
Fokus schaut — kann das nicht.

**Idee:** Klick oder Pinch schaltet auf `original` um und erlaubt Pan. Erst bei dieser
Geste wird die große Datei geholt, nie vorher. Bewusst getrennt von den bereits
gelisteten Punkten Fullscreen und Download: Zoom ist Beurteilung, nicht Präsentation
und nicht Übergabe.

**Nebenbei zu korrigieren:** der Kommentar in `Lightbox.tsx:5`. Er beschreibt eine
Absicht, nicht das Verhalten.

---

### B3. Farbmanagement — **eine offene Frage, keine Behauptung, S für die Messung**

Aus B2 folgt eine Frage, die ich mit Codelesen allein nicht beantworten kann und die
deshalb hier als **Messaufgabe** steht, nicht als Befund:

Fotografen arbeiten in AdobeRGB oder Display-P3. Wenn Folio ausschließlich Immichs
Preview-Tier ausliefert (siehe B2), dann hängt die Farbtreue des gesamten Portfolios
daran, was Immich beim Erzeugen dieser Previews mit dem Farbprofil macht — und ob
`streamAsset()` das Profil mit durchreicht. Fehlt es, rendert der Browser die Bytes
als sRGB: Wide-Gamut-Material wirkt dann flau oder, umgekehrt eingebettet,
übersättigt. Und zwar ausgerechnet auf dem guten Display, an dem der Fotograf sitzt.

**Testweg:** Eine Datei mit sichtbar breitem Gamut (gesättigtes Rot/Cyan) in AdobeRGB
nach Immich laden, in Folio öffnen, die ausgelieferten Bytes auf ein eingebettetes
ICC-Profil prüfen und gegen dieselbe Datei lokal im Browser vergleichen.

**Wenn sich ein Verlust zeigt,** sind die Antworten der Reihe nach: Profil im Proxy
mit durchreichen (Header und Bytes bleiben unangetastet — `streamAsset()` streamt
ohnehin unverändert); und für die Zoom-Ansicht aus B2 gleich das Original nehmen, das
sein Profil mitbringt.

**Wenn sich keiner zeigt,** ist der Abschnitt einen Satz in der Doku wert — „Folio
liefert Immichs Previews unverändert aus, inklusive Farbprofil" — und damit erledigt.
Auch das ist ein Ergebnis: Farbtreue ist bei dieser Zielgruppe ein
Vertrauensargument, und ein belegter Satz dazu ist mehr wert als ein Feature.

---

## C. Vertrauen & Privatsphäre

### C1. Ortsangaben pro Album steuern — **S**

**Befund, sorgfältig gelesen:** Die Map ist datenschutzseitig deutlich besser gebaut,
als man befürchten würde. Passwortgeschützte Alben werden vor der Aggregation
herausgefiltert (`app/api/map/route.ts:63-66`), und `lib/mapService.ts:5-11` hält
Alben ausdrücklich getrennt, damit genau das möglich ist. Die öffentliche EXIF-Route
gibt Koordinaten gar nicht erst heraus.

Die Lücke ist eine andere und feiner: Für **öffentliche** Alben wird ein Marker aus
dem **Mittelwert der tatsächlichen Koordinaten** aller Fotos an diesem Ort gebildet.
Bei einem Reisealbum über eine ganze Stadt ist das unkritisch. Bei einem Album, das an
_einem_ Ort entstanden ist — der eigene Garten, das Wohnzimmer eines Kunden, das
Studio, ein empfindlicher Naturstandort —, ist der Mittelwert genau dieser eine Ort.
Der Marker heißt zwar nach der Stadt, steht aber auf dem Grundstück.

Niemand trifft diese Entscheidung heute bewusst; sie ergibt sich daraus, dass die
Kamera GPS mitschreibt.

**Idee:** Eine Granularität pro Album und pro Subpage:

```yaml
location: exact # heutiges Verhalten
location: city # auf das Stadtzentrum runden, nicht mitteln
location: country # nur im Land verorten
location: hidden # gar nicht auf der Karte
```

Der Eingriff sitzt in `lib/mapService.ts`, wo bereits pro Album aggregiert wird — die
Stelle, an der man die Auflösung reduziert, existiert also schon.

**Warum das zieht:** Es macht aus einer stillschweigenden Preisgabe eine bewusste
Entscheidung. Für ein Projekt, dessen Verkaufsargument „dein Immich bleibt privat"
lautet, ist das kein Nebenfeature, sondern eine Konsequenz derselben Haltung.

---

### C2. Terminierte Veröffentlichung — **S**

**Befund:** `draft: true` gibt es nur für Journal-Einträge (`app/journal/page.tsx:33`,
Drafts bleiben für den eingeloggten Admin sichtbar — ein gutes Muster). Alben und
Subpages sind live, sobald sie in der YAML stehen. Wer eine Seite vorbereiten will,
muss sie entweder verstecken (`hidden: true`, seit #431) und im richtigen Moment von
Hand umstellen, oder sie erst im letzten Moment anlegen.

**Idee:** Ein `publishAt`-Datum für Alben, Subpages und Journal-Einträge. Vor dem
Termin verhält sich der Eintrag wie ein Draft: für den Admin sichtbar, für alle
anderen nicht vorhanden.

**Warum das billig ist:** Alle Seiten sind `force-dynamic`. Es braucht keinen
Scheduler, keinen Cron, keinen Hintergrundjob — nur einen Datumsvergleich beim
Ableiten der Galerie, an derselben Stelle, an der heute schon `enabled` und `hidden`
ausgewertet werden.

**Warum es trifft:** Es ist ein realer Ablauf, kein hypothetischer. Die
Hochzeitsgalerie geht Freitag um 18 Uhr auf, wenn das Paar aus den Flitterwochen
zurück ist. Die Serie erscheint zum Ausstellungstermin. Das Journal zum Buchstart.
Heute heißt das: Wecker stellen und selbst am Rechner sitzen.

**Ein Detail, das mitgedacht gehört:** Der RSS-Feed aus D darf einen terminierten
Eintrag nicht vorab ausliefern — dieselbe Prüfung, dieselbe Stelle.

---

## D. RSS/Atom-Feed — konkretisiert

Steht seit Mai als Einzeiler in [`brainstorm.md`](brainstorm.md) („`/feed.xml` mit
neuen Alben", Zeile 23) und dort auf Platz 1 der Reihenfolge. Verifiziert: eine
Feed-Route existiert nicht. Hier zum ersten Mal durchdacht — und der interessante
Teil ist nicht das XML.

**Der eigentliche Inhalt dieses Features ist die Ausschlussliste.** Ein Feed sammelt
genau das ein, was die Zugangskontrolle sonst verbirgt: Titel, Beschreibungen,
Cover-Bilder, Veröffentlichungsdaten. Er ist damit die perfekte Leak-Fläche, und
zwar eine, die niemandem auffällt, weil sie im Browser nie sichtbar wird. Draußen
bleiben müssen:

- passwortgeschützte Subpages und Alben (`password:` auf beiden Ebenen)
- `hidden: true`-Subpages — sie sind bewusst nur per Direktlink erreichbar, und ein
  Feed ist das Gegenteil eines Direktlinks
- Journal-Drafts (`draft: true`)
- alles mit einem `publishAt` in der Zukunft, falls C2 kommt
- Alben, die per Client-Link aus A1 zugänglich sind

**Zwei Quellen, ein Feed:** Journal-Einträge (haben Datum, Titel, Excerpt und Cover —
alles schon da) und neu hinzugekommene Alben. Cover-Bilder über den bestehenden
`/api/og`-Weg, damit kein neuer Bildpfad entsteht.

**Was es absichert:** ein Test, der die Ausschlussregel festschreibt — analog zu
`app/api/admin/__tests__/admin-guards.test.ts`, also **tabellengetrieben über die
Kategorien**, nicht als Sammlung von Einzelfällen. Dann schlägt er auch bei einer
künftig hinzugefügten Sichtbarkeitsregel an, die jemand im Feed zu berücksichtigen
vergisst.

**Aufwand:** S für den Feed. Die Sorgfalt steckt komplett in der Sichtbarkeitsprüfung —
und die ist der Grund, warum dieser Punkt hier nochmal auftaucht, statt als Einzeiler
stehenzubleiben.

---

## Anhang: zwei Kleinigkeiten zur Auffindbarkeit

Kurz gehalten, weil Auffindbarkeit diesmal nicht der Schwerpunkt war — aber beide sind
XS und stehen in keiner der alten Listen:

- **Es gibt weder `app/sitemap.ts` noch `app/robots.ts`.** Robots-Direktiven existieren
  nur auf Meta-Ebene (`app/layout.tsx:37-48`). Next.js erzeugt beide Dateien aus je
  einer Funktion; die Album- und Subpage-Liste liegt in `getConfig()` bereit. Dieselbe
  Ausschlussliste wie beim Feed gilt auch hier.
- **Kein JSON-LD.** Für ein Fotografie-Portfolio ist `ImageObject` mit `creator` und
  `license` die eine strukturierte Angabe, die sich wirklich auszahlt — Google Bilder
  zeigt Lizenzhinweise an, und es ist die einzige Stelle, an der ein Fotograf seine
  Urheberschaft maschinenlesbar an die Bilder heftet. Passt inhaltlich zu A2: wer
  Lizenzanfragen will, sollte auffindbar machen, dass Lizenzen zu haben sind.

---

## Empfohlene Reihenfolge

**Erst — klein, sofort spürbar:**

1. **C2** Terminierte Veröffentlichung · _S_ — ein Datumsvergleich, ein echter Ablauf
2. **C1** Ortsangaben pro Album · _S_ — die Stelle im Code existiert bereits
3. **B2** 1:1-Zoom · _S_ — und der falsche Kommentar in `Lightbox.tsx:5` fällt mit weg

**Dann — die zwei mit dem größten Hebel:**

4. **B1** Sequenzierung wie im Fotobuch · _M_ — das Alleinstellungsmerkmal
5. **A1** Ablaufende Client-Links · _M_ — das Feature, das aus dem Portfolio ein
   Arbeitswerkzeug macht

**Danach:**

6. **D** RSS-Feed · _S_ — mit der Ausschlussliste als eigentlicher Arbeit
7. **A2** Anfrage-Formular · _S–M_ — mit Webhook beginnen, SMTP später
8. **A3** Proofing-Notizen · _S_ — kleine Variante
9. **B3** Farbmanagement messen · _S_ — Ergebnis offen, Erkenntnis in jedem Fall wertvoll
10. Anhang: Sitemap, `robots.ts`, JSON-LD · _XS_

---

## Roter Faden

Drei Sätze halten die Auswahl zusammen.

**Ein Portfolio ist Arbeit, nicht nur Ausstellung.** A1–A3 begleiten den Weg, den ein
Auftragsbild ohnehin nimmt — Übergabe, Rückmeldung, Anfrage. Folio zeigt heute nur
den mittleren Teil davon.

**Reihenfolge ist Handwerk.** B1 ist der einzige Punkt hier, den kein vergleichbares
Werkzeug bietet, und er trifft die Zielgruppe genau dort, wo sie anspruchsvoll ist.

**Privatsphäre gilt nach außen genauso wie nach innen.** Das Versprechen lautet „dein
Immich bleibt privat". C1 und C2 ziehen dieselbe Linie für das, was die
veröffentlichte Seite über Orte und Zeitpunkte verrät — und D stellt sicher, dass ein
Feed sie nicht hintenherum wieder aufmacht.
