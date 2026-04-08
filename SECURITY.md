# Security Policy

## Ondersteunde Versies

Dit project volgt een voortschrijdend release model. Zorg ervoor dat je altijd de nieuwste versie gebruikt.

| Versie | Status                    | Ondersteund tot |
| ------ | ------------------------- | --------------- |
| 1.x    | :white_check_mark: Actief | Huidig          |
| < 1.0  | :x: Deprecated            | Niet            |

## Beveiligingsverwachtingen

Dit project is een **demo/educatief project** met de volgende beveiligingskenmerken:

### Wat is beschermd

- ✅ SQL injection preventie via prepared statements
- ✅ Environment variabelen voor gevoelige gegevens (API-sleutels, databasewachtwoorden)
- ✅ HTTPS-aanbevelingen voor productie

### Wat moet je zelf beveiligen

- ⚠️ `.env` bestand (nooit in git committen)
- ⚠️ Database credentials
- ⚠️ API-sleutels (Mistral, etc.)
- ⚠️ Input validatie op de server

## Gevoeligdheden en Beperkingen

Dit project is nog **onder ontwikkeling** en heeft de volgende bekende beveiligingskwesties:

- [ ] Geen rate limiting op de chat endpoint
- [ ] Geen authenticatie/autorisatie geïmplementeerd
- [ ] Gevoeligheidsanalyse van chatbot output
- [ ] CORS-configuratie moet worden gecontroleerd
- [ ] Input validatie moet uitgebreid worden

## Rapporteren van Kwetsbaarheden

**Plaats gevoelige beveiligingsproblemen NIET openbaar op GitHub Issues.**

### Stappen voor rapportage

1. **Stuur een email** naar: `[voeg hier je contact email in]`
   - Onderwerp: `Security Vulnerability Report - [korte omschrijving]`
   - Beschrijving van het probleem
   - Hoe het probleem te reproduceren
   - Potentiële impact

2. **Wat te verwachten:**
   - Bevestiging van ontvangst: binnen 24-48 uur
   - Status-updates: minstens wekelijks
   - Patch-timeline: afhankelijk van ernst

3. **Prioriteitsclassificatie:**
   - 🔴 **Kritiek**: Onmiddellijke actie (24-72 uur)
   - 🟠 **Hoog**: Snelle fix (1-2 weken)
   - 🟡 **Gemiddeld**: Gepland fix (1 maand)
   - 🟢 **Laag**: Volgende release

## Best Practices

### Voor Gebruikers

```bash
# 1. Clone en installeer
git clone https://github.com/boudewijn010/chatassistend-Boiten.git
cd chatassistend-Boiten

# 2. Maak .env bestand met gevoelige gegevens
cp .env.example .env
# Vul API-sleutels en databasegegevens in

# 3. Zorg dat .env in .gitignore staat
echo ".env" >> .gitignore

# 4. Installeer dependencies en draai voorzichtig op localhost
npm install
npm run dev
```

### Voor Ontwikkelaars

- Regelmatig `npm audit` uitvoeren
- Dependencies bijhouden en updates toepassen
- Git hooks gebruiken voor pre-commit checks
- Geen credentials in code committen
- Environment-specifieke configuratie via `.env`
- HTTPS afdwingen in productie

## Bekende Problemen

Zie ook: [GitHub Issues](https://github.com/boudewijn010/chatassistend-Boiten/issues?q=is%3Aissue+label%3Asecurity)

## Licentie

Dit project is gelicenseerd onder ISC License. Zie [LICENSE](LICENSE) voor details.

## Vragen?

Voor vragen over beveiliging (niet kritiek), open een [Discussion](https://github.com/boudewijn010/chatassistend-Boiten/discussions) op GitHub.
