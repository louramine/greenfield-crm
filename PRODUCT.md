# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The Greenfield team: three associates (one admin) and their land sourcers. They use the CRM every day, as much on the phone (in the field, at a developer's office, between two visits) as on the computer (data entry, analysis, preparing sends). Confirmed: phone and computer in equal measure.

## Product Purpose

Greenfield is a land sourcing and transaction intermediary in Morocco (Casablanca and surroundings, Rabat, Marrakech, Tanger). The CRM holds the land portfolio (about 850 to 1 000 plots: reference GF-AA-NNNN, neighbourhood, zoning code, surface, price per m², lump price, land title, status, sourcer) and the base of real estate developers who buy land (about 125 contacts, about 50 companies).

The two jobs that must be fastest and most pleasant (confirmed):
1. Following deals and follow-ups: the deal pipeline (teaser sent, NDA signed, site visit, offer received, closing), deal tasks, next actions and follow-up dates.
2. Proposing plots to developers: matching a plot to the developers whose criteria fit, sending it on WhatsApp, and tracking each developer's answer, from which their preferences are learned.

Success: no deal or follow-up is forgotten, and each developer only receives plots that fit them.

## Positioning

A land-specific CRM, not a generic sales CRM: two business objects (plots and developers) matched on zoning, neighbourhood, surface and price, with preferences learned from each developer's answers.

## Operating Context

- Plots arrive mostly on WhatsApp (location, cadastral plan, title certificate, urban planning note) and are typed in by sourcers.
- Developers are contacted by phone and WhatsApp; a WhatsApp chatbot (in progress) will log conversations and answers into the CRM.
- Roles: admin, associate, sourcer. Sourcers edit only their own plots and do not see other people's deals.
- Data lives in Supabase; the app is a single HTML file deployed on Vercel at crm.greenfield.plus.

## Capabilities and Constraints

- Pages: Dashboard, Pipeline, Matching (plot analysis and developer matching), Map (Google My Maps embed), Plots, Developers, Marketing (social posts and PDF proposals), Team.
- Single-file vanilla HTML/CSS/JS, no build step. Must keep working on desktop and on mobile Safari.
- Vocabulary is French. Units: m², DH/m² (MAD), M DH for lump prices.

## Brand Commitments

Binding (confirmed): the CRM follows the greenfield.plus website identity: GREENFIELD+ logo in mint, dark ink and deep green grounds, mint accent (#7ee0a4), Archivo for display, Inter Tight for text, JetBrains Mono for small labels.

## Evidence on Hand

Real data: plot listing (Excel of 14/09/2026, My Maps export), developer list (BDD promo Greenfield), white paper. No testimonials or client logos to show in the CRM.

## Product Principles

1. Nothing slips: every deal and every follow-up has a visible next action and date.
2. Send less, but right: a developer only gets plots that match what he wants and what he answered before.
3. One gesture away: the frequent actions (call, WhatsApp, propose, note an exchange) are reachable from wherever the user is, on phone and desktop.
4. The data is the interface: plots and developers are read at a glance (reference, place, surface, price, zoning), without decoration.
