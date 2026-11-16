# Chatbot WhatsApp GREENFIELD relié au CRM

Le chatbot répond sur le numéro WhatsApp GREENFIELD, dans la langue du premier message du contact, et range tout ce qu'il apprend directement dans le CRM (crm.greenfield.plus).

Langues : français, anglais, arabe, et darija en lettres latines (« salam, bghit nbi3 l'ard ») ou en lettres arabes. Les messages libres sont rédigés par Claude dans la langue du contact. Les boutons, les fiches terrain et les confirmations sont traduits à l'avance dans ces cinq versions.

## Ce qu'il fait

**Un promoteur déjà dans la base écrit**
* Il est reconnu par son numéro et salué par son nom. Le bot ne lui demande pas s'il vend ou s'il achète.
* Le bot pose une question à la fois, uniquement sur ce qui manque dans sa fiche : zones, produits développés, zonages, superficie, budget, horizon d'achat, mode d'acquisition, accord pour recevoir des terrains sur WhatsApp.
* Les réponses vont dans les champs de la fiche promoteur avec les mêmes libellés que le CRM. Le Matching et les terrains à proposer en tiennent compte tout de suite.
* Le bot complète les champs vides et ajoute des villes ou des produits aux listes. Il n'écrase jamais une saisie de l'équipe. En cas de contradiction, il l'écrit dans les notes du promoteur, une seule fois.
* Le statut passe de « À qualifier » ou « Froid » à « Tiède » dès que le promoteur a donné au moins deux critères.

**Le bot propose des terrains au promoteur**
* Dès que la fiche du promoteur contient une zone (ville ou quartier) et au moins un autre critère (zonage, produit, superficie ou budget), le bot choisit dans le portefeuille les terrains « Disponible » qui lui correspondent.
* Le choix utilise le même score que la page Matching du CRM, avec les préférences apprises de ses réponses passées. Le bot ne propose jamais un terrain hors des zones ciblées, hors budget, au-dessus du prix au m² annoncé, hors de la fourchette de superficie, dans un secteur déjà refusé, vendu ou déjà proposé.
* Il envoie 3 terrains au plus, un message par terrain, avec la référence, le lieu, la superficie, le zonage et le prix, et trois boutons : Intéressé, Plus d'infos, Pas intéressé. Le titre foncier, le lien Maps et le vendeur ne sont jamais envoyés.
* Chaque terrain envoyé apparaît dans l'onglet « Terrains proposés » du promoteur, avec le canal « WhatsApp (chatbot) » et le score obtenu.
* Une série au plus toutes les 24h. Si le promoteur écrit « vous en avez d'autres ? », le bot envoie la série suivante, ou dit qu'il n'y a rien de nouveau pour l'instant.
* Pas de propositions si le promoteur a refusé les envois WhatsApp ou envoyé STOP.

**Un promoteur réagit à un terrain proposé**
* Par écrit (« merci mais Bouskoura ne nous intéresse pas ») ou avec les boutons d'un teaser, sa réponse est enregistrée dans « Terrains proposés » : intéressé, demande d'infos, visite souhaitée, à rappeler, ou refusé avec le motif.
* Les préférences apprises du CRM se mettent à jour.

**Un vendeur ou un intermédiaire écrit**
* Le bot recueille la localisation, la position, la superficie, le statut foncier, le numéro de titre, la propriété, le zonage, le prix, la viabilisation, l'accès, l'occupation, les documents et le délai.
* Dès que la localisation et la superficie sont connues, le terrain est créé dans le portefeuille au statut « À qualifier », avec la source « WhatsApp ».
* Les notes de renseignement, certificats de propriété et plans envoyés en photo ou en PDF sont lus par Claude et rangés dans les documents du terrain.

**Une personne inconnue cherche du foncier**
* Une fiche promoteur est créée avec la source « WhatsApp ».

**Dans tous les cas**
* Chaque message apparaît dans l'onglet « Échanges » du promoteur et dans la nouvelle page **WhatsApp** du CRM.
* La page WhatsApp montre pour chaque conversation :
  * la fiche d'appel : résumé, créneau souhaité, points à vérifier, informations manquantes
  * ce que le bot a recueilli
  * la conversation, avec les photos, PDF et vocaux.
* Depuis cette page, on peut répondre en tant que conseiller, mettre le bot en pause et noter le compte rendu d'appel.
* Quand la qualification est terminée, un échange « WhatsApp » est ajouté au promoteur ou au terrain avec le résumé pour l'appel.
* Dès qu'un conseiller répond, que ce soit depuis le CRM ou depuis l'application WhatsApp Business du téléphone, le bot se tait 24h pour ce contact.
* « STOP » désinscrit le contact. Le CRM bloque alors les envois.

## Fichiers

* `api/whatsapp/webhook.js` : réception des messages
* `api/whatsapp/send.js` : réponse d'un conseiller depuis le CRM
* `api/whatsapp/teaser.js` : envoi de teasers par modèle validé par Meta (facultatif)
* `api/_lib/bot.js` : déroulé des conversations, boutons, propositions de terrains, écriture dans le CRM
* `api/_lib/qualification.js` : questions, lecture des réponses et rédaction des messages par Claude
* `api/_lib/matching.js` : choix des terrains à proposer, avec le score de la page Matching
* `api/_lib/textes.js` : boutons et messages fixes en français, anglais, arabe et darija
* `api/_lib/crm.js`, `api/_lib/supabase.js`, `api/_lib/whatsapp.js`, `api/_lib/claude.js`, `api/_lib/terrains.js` : accès aux données et aux services
* `wa-crm.js` : page WhatsApp du CRM
* `supabase/chatbot-whatsapp.sql` : script de la base (déjà exécuté)
* `api/_lib/test-simulation.js` : 16 scénarios de test sans réseau (`npm run test:whatsapp`)

## Mise en service

### 1. Base de données

Déjà fait : le script `supabase/chatbot-whatsapp.sql` a été exécuté dans Supabase (tables des conversations et des messages, espace de stockage des médias). Rien à refaire.

### 2. Numéro WhatsApp en mode coexistence (30 minutes)

1. Mettez à jour l'application WhatsApp Business du téléphone GREENFIELD (version 2.24.17 ou plus récente).
2. Créez un compte sur le hub 360dialog et ajoutez un numéro. Dans la fenêtre Meta, choisissez **Connecter une application WhatsApp Business existante**. N'utilisez pas l'option nouveau numéro : elle retirerait le numéro de l'application.
3. Scannez le QR code avec l'application et acceptez le partage de l'historique.
4. Dans le hub 360dialog, générez la clé API du numéro (D360-API-KEY).
5. Désactivez le message d'accueil et le message d'absence de l'application WhatsApp Business, sinon le contact recevrait deux réponses.

### 3. Clé Claude (10 minutes)

Sur console.anthropic.com : ajoutez du crédit dans Billing, puis créez une clé dans API Keys.

### 4. Réglages Vercel (10 minutes)

Dans Vercel, projet greenfield-crm, Settings puis Environment Variables, ajoutez pour l'environnement Production :

* `SUPABASE_URL` = `https://hjscwsybbcjpditudssq.supabase.co`
* `SUPABASE_SERVICE_ROLE_KEY` = la clé service_role (Supabase, Project Settings, API). Elle ne doit jamais être mise dans index.html.
* `WA_PROVIDER` = `360dialog`
* `D360_API_KEY` = la clé de l'étape 2
* `WA_WEBHOOK_SECRET` = un mot de passe long inventé, par exemple 32 lettres et chiffres
* `ANTHROPIC_API_KEY` = la clé de l'étape 3

Réglages facultatifs :

* `COMPANY_NAME` (GREENFIELD par défaut)
* `DEBOUNCE_SECONDS` : délai de regroupement des messages envoyés à la suite (5 par défaut)
* `HUMAN_TAKEOVER_PAUSE_HOURS` : durée de pause du bot après une réponse humaine (24 par défaut)
* `CLAUDE_MODEL_REPLY` et `CLAUDE_MODEL_EXTRACT` : modèles Claude utilisés pour répondre et pour remplir les fiches
* `TEAM_NUMBERS` : numéros de l'équipe à alerter, séparés par des virgules, avec un modèle `greenfield_alerte` validé par Meta. Ces numéros ne sont jamais traités comme des contacts.
* `PROPOSITION_AUTO` : mettre `0` pour que le bot ne propose plus de terrains de lui-même
* `PROPOSITION_MAX` : nombre de terrains par série (3 par défaut)
* `PROPOSITION_STATUTS` : statuts de terrain proposables, séparés par des virgules (`Disponible` par défaut)

### 5. Mise en ligne

Fusionnez la branche `chatbot-whatsapp-v2` dans `main` : Vercel met le CRM à jour automatiquement. Vérifiez que `https://crm.greenfield.plus/api/whatsapp/webhook` affiche `{"ok":true}`.

### 6. Brancher WhatsApp sur le CRM (5 minutes)

Depuis un ordinateur, remplacez `VOTRE_CLE_360` et `VOTRE_SECRET`, puis lancez :

Sur Mac (Terminal) :

```
curl -X POST https://waba-v2.360dialog.io/v1/configs/webhook -H "D360-API-KEY: VOTRE_CLE_360" -H "Content-Type: application/json" -d '{"url": "https://crm.greenfield.plus/api/whatsapp/webhook?cle=VOTRE_SECRET"}'
```

Sur Windows (PowerShell) :

```
Invoke-RestMethod -Method Post -Uri "https://waba-v2.360dialog.io/v1/configs/webhook" -Headers @{"D360-API-KEY"="VOTRE_CLE_360"} -ContentType "application/json" -Body '{"url": "https://crm.greenfield.plus/api/whatsapp/webhook?cle=VOTRE_SECRET"}'
```

Demandez ensuite au support 360dialog d'activer les webhooks de coexistence (`smb_message_echoes`) pour votre numéro. C'est ce qui permet au bot de se taire quand vous répondez depuis le téléphone.

### 7. Tester avant d'ouvrir aux clients

Depuis un autre téléphone :

1. Écrivez « Salam, bghit nbi3 wa7d l'ard f Bouskoura ». Le bot répond en darija en lettres latines.
2. Donnez une superficie, puis vérifiez que le terrain apparaît dans Terrains, au statut « À qualifier ».
3. Envoyez une photo de note de renseignement, puis vérifiez qu'elle est rangée dans les documents du terrain.
4. Depuis le numéro d'un promoteur de la base, écrivez « Bonjour, nous cherchons du foncier à Rabat ». Le bot le salue par son nom, et la ville apparaît dans sa fiche promoteur.
5. Toujours depuis ce numéro, écrivez « Plutôt Casablanca, budget 10 à 50 millions ». Le bot envoie jusqu'à 3 terrains avec des boutons, et ils apparaissent dans « Terrains proposés » de la fiche.
6. Appuyez sur « Plus d'infos », puis « Pas intéressé » sur un autre terrain et choisissez un motif. Les deux réponses sont enregistrées dans la fiche.
7. Écrivez « Hello, we are looking for land in Marrakech ». Le bot répond en anglais, boutons compris.
8. Répondez depuis l'application WhatsApp Business : le bot ne répond plus à ce contact pendant 24h.
9. Ouvrez la page WhatsApp du CRM et vérifiez la fiche d'appel et la conversation.

En cas de problème, les journaux sont dans Vercel, onglet Logs, en filtrant sur `/api/whatsapp`.

## Option : teasers avec boutons

Le bouton WhatsApp de la fiche promoteur ouvre toujours votre application avec le message prêt. Le bot traite ensuite la réponse écrite du promoteur.

Pour envoyer les teasers directement avec les boutons Intéressé, Infos, Visite et Non, il faut faire valider par Meta, dans le hub 360dialog, un modèle `greenfield_teaser`. Le texte contient 6 variables dans cet ordre :
1. nom
2. lieu
3. superficie
4. zonage
5. prix
6. référence.

Les 4 boutons sont des réponses rapides. La fonction `api/whatsapp/teaser.js` est prête à l'utiliser.

## Coûts

* WhatsApp : depuis le 1er octobre 2026, 1 000 messages de service gratuits par mois et par numéro, puis un tarif par message. Les messages envoyés depuis l'application restent gratuits.
* 360dialog : abonnement mensuel du fournisseur.
* Claude : quelques centimes par conversation.
* Vercel et Supabase : inchangés.

## Données personnelles

Les conversations contiennent des données personnelles (noms, numéros, titres fonciers). Au Maroc, ce traitement relève de la loi 09-08. Pensez à la déclaration auprès de la CNDP et à une mention dans le profil WhatsApp Business, par exemple : « Les premiers échanges sont assurés par un assistant automatique. »

Seuls les admins et les associés voient la page WhatsApp.
