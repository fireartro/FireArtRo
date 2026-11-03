# FireArtRo

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Site-ul prezintă spectacolele FireArtRo vizitatorilor. Adminul este folosit de proprietar pentru conținut, imagini, pachete, galerie, parteneri, solicitări și publicare.

## Product Purpose

Vizitatorii descoperă serviciile și trimit solicitări. Proprietarul trebuie să poată actualiza conținutul și controla încadrarea imaginilor pe telefon, tabletă și desktop fără editarea codului sau a fișierelor originale.

## Operating Context

Interfața este în română. Proprietarul a aprobat un admin compact, cu listă și editor, selector vizual de imagini, reglaje independente pe dispozitiv, salvare în draft și publicare controlată. Previzia trebuie să reproducă regulile responsive ale paginii publice.

## Capabilities and Constraints

- Site React și API FastAPI; schemele de conținut sunt validate pe client și server.
- Salvarea automată în draft este distinctă de publicare. Istoricul permite restaurarea unei versiuni ca draft.
- Imaginea aleasă explicit trebuie respectată. Resetarea încadrării nu schimbă selecția fotografiei.
- Poziția, zoomul, modul de umplere și forma cadrului aparțin utilizării imaginii și dispozitivului; nu rescriu sursa.
- Conținutul vechi fără reglaje personalizate trebuie să rămână valid și să păstreze geometria inițială.
- Verificările de editare și publicare se fac pe o copie locală izolată, fără modificarea conținutului real.
- Autentificarea și secretele rămân gestionate pe server. Previzualizarea privată este autentificată și transmite draftul numai ferestrei proprii de aceeași origine.

## Brand Commitments

FireArtRo, limba română, identitatea existentă întunecată și accentul albastru. Pentru admin, proprietarul cere densitate utilă, aspect îngrijit și controale clare, fără ornamentație generică de tip „AI slop”.

## Evidence on Hand

Propunerea confirmată: `docs/plans/2026-11-02-admin-workspace-design.md`. Conținutul CMS, catalogul foto/video și activele de brand existente reprezintă sursa factuală. Ghidul pentru proprietar: `docs/admin-image-editing.md`.

## Product Principles

1. Proprietarul vede și controlează alegerea imaginii și încadrarea ei.
2. Previzualizarea trebuie să corespundă afișării publice.
3. Modificările sunt verificabile și reversibile înainte de publicare.
4. Densitatea interfeței păstrează textul lizibil și utilizarea cu tastatura sau pe ecran tactil.
