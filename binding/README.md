# binding-vti — die Wire-Bindung unter dem Adapter

Die konkrete `MediatorWire`-Implementierung über `vti-didcomm-js`
(Dogwood-Pin `1d110bf`) und `vti-tsp-js` 0.2.0 (Registry = Dogwood-
Stand, enthält unseren noble-HPKE-Beitrag). **Dev-only** — nie eine
Abhängigkeit der zero-dependency lib; das Profil
(`spec/adapter-vti-mediator.md` §7) benennt genau die Pflichten, die
hier wohnen.

## Was hier liegt

- `vti-wire.mjs` — `createVtiWire(cfg)`:
  - leitet die **Wire-Identitäten aus derselben HKDF** ab wie die
    lib (gleiche Präfixe → byte-identische DIDs zum Adapter-Trio;
    gemessen in der Probe);
  - ATM-Auth unter der Connection-DID, ein Pickup-Socket;
  - `deposit` = TSP-Direct-Pack des versiegelten RLTP-Envelopes,
    **Sender = Egress-Identität** (§5a.10);
  - `onDeliver` entpackt den TSP-Rahmen und reicht die **inneren
    Payload-Bytes wahrheitsgetreu** an den Adapter (M-2-Pflicht) —
    inklusive der **Ack-Übersetzung** (Payload-Digest ↔ Mediator-
    Queue-ID über den qb64-Text);
  - **Delete-to-Ack unter der Hoheit des Adapters**: die 0.7.0-
    Session ackt sonst sofort nach dem Consumer; die Subclass
    `RltpMediatorSession` hebt das auf — geackt wird erst, wenn der
    Adapter `conclude` sagt.
- `live-probe.mjs` — env-gated (`RLTP_LIVE_MEDIATOR=1`): zwei
  Beziehungen gegen die öffentliche Dev-Instanz, deposit → deliver
  → conclude in beide Richtungen. **PASS am 04.09.2026.**
- `.sender-hypothesis.mjs` — Naht-Messung: Der Mediator leitet
  TSP-Frames **auch mit fremder Sender-VID** weiter (er
  authentifiziert Envelope-Sender nicht — konsistent mit TSPs
  eigener Haltung, Rev-3-Intermediary-Kapitel). Damit funktioniert
  die Egress-Identität im Direct-Mode ohne Sonderwege.

## Gemessene Betriebsfakten

1. **`register()` ist die Transportzulassung** — erst sie öffnet
   ATM-Session und Pickup-Socket; `collect()` hat keinen eigenen
   Wire-Verkehr. Ein Empfänger, der nie registriert, empfängt nie
   (die erste Probe-Fassung ist genau daran gescheitert).
2. Der Mediator **routet auf der Envelope-Empfänger-VID** der
   authentifizierten Verbindung; eine Keylist ist für
   did:key-Clients nicht nötig (deckt sich mit ref-04).
3. M-2 hält live: 64-Byte-Zufalls-Envelopes kamen byte-identisch an.

## Ausführen

```sh
cd binding && npm install
RLTP_LIVE_MEDIATOR=1 npm run probe        # braucht Netz
MEDIATOR_DID=... npm run probe            # andere Instanz
```

## Bewusst offen (nächste Einheiten)

- **Routed-Mode** (Outer-Hop an den Mediator) und der
  §5a.10-Peer-Wechsel via **Rev-3-Referral** — erst sinnvoll, wenn
  Rev 3 im Stack gelandet ist (OpenVTC-Switch „prior to Linux
  event"; wir messen ihn über sync-Digest + Leiter).
- Der Rev-3-Cipher-Wechsel (HPKE-Auth → Base): vti-tsp-js 0.2.0
  nutzt noch den Cypress-Dialekt; beim Stack-Switch wird diese
  Bindung neu vermessen.
- Offline-Signal (`wire.offline()`): der Socket-Zustand ist die
  natürliche Quelle; noch nicht verdrahtet.
