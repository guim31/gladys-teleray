# Téléray

## Was die Integration macht

Bringt die **Gamma-Ortsdosisleistung** der Sonden des **Téléray**-Netzes der ASNR (französische Behörde für nukleare
Sicherheit und Strahlenschutz, früher IRSN) in Gladys: rund 480 Sonden in Frankreich, in den Überseegebieten und in
einigen Botschaften, eine Messung alle 10 Minuten. Die Integration liest die öffentliche Téléray-Karte
([teleray.asnr.fr](https://teleray.asnr.fr)), ohne Konto.

Für jede verfolgte Sonde: die Dosisleistung, ihr 24-Stunden-Mittel, der Untergrund der Sonde, Zeit und Zustand der
Messung, ein Dashboard-Widget mit der 24-Stunden-Kurve und Szenen-Auslöser, wenn die Dosisleistung über den
Untergrund steigt.

**Diese Integration ist kein offizielles Warnsystem**: Folge im Notfall den Anweisungen der Behörden. Natürliche
Werte schwanken: Regen wäscht Radon-Folgeprodukte aus und kann für einige Stunden 20 bis 50 nSv/h hinzufügen. Die
Integration ist nicht mit der ASNR verbunden. Daten © ASNR.

## Voraussetzungen

- Gladys 5.3.0 oder neuer.
- Internetzugang von Gladys aus.
- Der Standort deines Hauses (Einstellungen → Häuser), um automatisch die nächste Sonde zu verfolgen.

## Konfiguration

1. Installiere die Integration: Integrationen → Von GitHub installieren, Adresse
   `https://github.com/guim31/gladys-teleray`.
2. **Sonden**: Lass das Feld leer, um die Sonde zu verfolgen, die deinem Haus am nächsten ist, oder gib bis zu 5
   Nummern oder Namen von Sonden ein, durch Kommas getrennt (z. B. `1411, PARIS-BERCY`). Der Button **Sonden um ein
   Haus finden** listet die nächsten mit Nummer und Entfernung auf.
3. **Sprache**: Sprache der Funktionsnamen (beim Hinzufügen eines Geräts festgelegt) und der Texte.
4. Öffne den Tab **Erkennung** und füge die Sonde hinzu.

## Geräte

Ein Gerät pro Sonde, nach ihr benannt (z. B. `TOULOUSE (Téléray)`):

| Funktion              | Was es ist                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| Dosisleistung (nSv/h) | Gamma-Ortsdosisleistung der letzten Messung, in Nanosievert pro Stunde                 |
| 24-h-Mittel (nSv/h)   | Mittel der gültigen Messungen der letzten 24 Stunden                                   |
| Untergrund (nSv/h)    | der übliche Wert der Sonde, von der ASNR berechnet                                     |
| Messzeit              | Zeit der letzten Messung (die Karte veröffentlicht sie 20 bis 40 Minuten später)       |
| Zustand der Sonde     | Messung validiert, Noch nicht validiert, Messung verworfen oder Keine aktuelle Messung |

Gladys hat keine Einheit für Strahlung: Die Einheit steht im Namen der Funktionen. Eine Messung, die älter als
2 Stunden ist, wird nicht mehr als aktuell veröffentlicht (der Zustand zeigt dann „Keine aktuelle Messung“), wie auf
der Karte der ASNR.

## Widget

**Téléray-Dosisleistung**: Dosisleistung, 24-h-Mittel und Untergrund als Kacheln, die Kurve der letzten 24 Stunden mit
dem Untergrund sowie Zeit, Zustand und Quelle der Messung. Einstellungen: die Sonde (leer: die zuerst hinzugefügte)
und zwei Schalter, um die Kurve oder Zeit und Zustand auszublenden.

## Szenen

- Auslöser **Dosisleistung über dem Untergrund**: Eine validierte oder ausstehende Messung übersteigt den Untergrund
  der Sonde um den gewählten Abstand (+20, +40, +100 oder +200 nSv/h). Einmal beim Überschreiten ausgelöst; der
  Abstand bleibt erreicht, bis die Dosisleistung 10 nSv/h darunter fällt. +40 nSv/h ist die Schwelle der ASNR-Karte.
  Variablen: Name der Sonde, Dosisleistung, Untergrund, Überschreitung, Messzeit.
- Auslöser **Dosisleistung wieder normal**: Nach einer Überschreitung liegt die Dosisleistung wieder weniger als
  10 nSv/h über dem Untergrund.
- Aktion **Dosisleistung einer Sonde abrufen**: die letzten Werte und ein fertiger Satz (`summary`) für eine
  Benachrichtigung.

Die Geräte liefern ihre Werte auch an die üblichen Szenen-Bedingungen.

## Szenenbeispiele

- Benachrichtige mich, wenn die Dosisleistung 40 nSv/h über dem Untergrund liegt: Auslöser „Dosisleistung über dem
  Untergrund“, Abstand +40 nSv/h, dann „Dosisleistung einer Sonde abrufen“ und eine Benachrichtigung mit der
  Zusammenfassung.
- Ein Wochenbericht: eine geplante Szene, „Dosisleistung einer Sonde abrufen“, dann eine Nachricht mit der
  Zusammenfassung.

## Fehlerbehebung

- **„Keine Sonde“**: Lege den Standort eines Hauses fest (Einstellungen → Häuser) oder gib eine Sonde in der
  Konfiguration ein.
- **„Unbekannte Sonden“**: Nummer oder Name wurde nicht gefunden; nutze den Such-Button und kopiere die Nummer.
- **„Die Téléray-Karte antwortet nicht“**: Die Messwerte werden alle 10 Minuten erneut gelesen.
- **„Keine aktuelle Messung“**: Die Sonde hat seit 2 Stunden nichts veröffentlicht (Wartung, Übertragung). Die Werte
  kommen mit ihrer nächsten Messung zurück.

## Grenzen

- Die Integration liest den Server der öffentlichen Téléray-Karte, der keine dokumentierte API hat: Er kann sich ohne
  Vorankündigung ändern.
- Die Messungen kommen 20 bis 40 Minuten nach der Messung an; eine Anfrage pro Sonde alle 10 Minuten, die Liste der
  Sonden einmal am Tag.
- Höchstens 5 Sonden.
- Die Funktionsnamen werden beim Hinzufügen des Geräts festgelegt; ein späterer Sprachwechsel benennt sie nicht um.
