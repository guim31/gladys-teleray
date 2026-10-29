# Téléray

## Ce que fait l'intégration

Amène dans Gladys le **débit de dose gamma ambiant** mesuré par les balises du réseau **Téléray** de l’ASNR
(Autorité de sûreté nucléaire et de radioprotection, ex-IRSN) : environ 480 balises en France, en outre-mer et dans
quelques ambassades, une mesure toutes les 10 minutes. L’intégration lit la carte publique Téléray
([teleray.asnr.fr](https://teleray.asnr.fr)), sans compte.

Pour chaque balise suivie : le débit de dose, sa moyenne sur 24 heures, le bruit de fond de la balise, l’heure et
l’état de la mesure, un widget de tableau de bord avec la courbe sur 24 heures, et des déclencheurs de scène quand le
débit monte au-dessus du bruit de fond.

**Cette intégration n’est pas un dispositif d’alerte officiel** : en cas d’urgence, suivez les consignes des
autorités. Les niveaux naturels varient : la pluie rabat au sol les descendants du radon et peut ajouter 20 à
50 nSv/h pendant quelques heures. L’intégration n’est pas affiliée à l’ASNR. Données © ASNR.

## Prérequis

- Gladys 5.3.0 ou plus récent.
- Un accès à Internet depuis Gladys.
- La position de votre maison (Paramètres → Maisons), pour suivre automatiquement la balise la plus proche.

## Configuration

1. Installez l’intégration : Intégrations → Installer depuis GitHub, adresse
   `https://github.com/guim31/gladys-teleray`.
2. **Balises** : laissez vide pour suivre la balise la plus proche de votre maison, ou saisissez jusqu’à 5 numéros ou
   noms de balises séparés par des virgules (ex. `1411, PARIS-BERCY`). Le bouton **Trouver les balises autour d’une
   maison** liste les plus proches avec leur numéro et leur distance.
3. **Langue** : langue des noms de fonctionnalités (fixés à l’ajout d’un appareil) et des textes.
4. Ouvrez l’onglet **Découverte** et ajoutez la balise.

## Appareils

Un appareil par balise, à son nom (ex. `TOULOUSE (Téléray)`) :

| Fonctionnalité        | Ce que c’est                                                                   |
| --------------------- | ------------------------------------------------------------------------------ |
| Débit de dose (nSv/h) | débit de dose gamma ambiant de la dernière mesure, en nanosieverts par heure   |
| Moyenne 24 h (nSv/h)  | moyenne des mesures valides des 24 dernières heures                            |
| Bruit de fond (nSv/h) | le niveau habituel de la balise, calculé par l’ASNR                            |
| Heure de la mesure    | heure de la dernière mesure (la carte la publie 20 à 40 minutes plus tard)     |
| État de la balise     | Mesure validée, Pas encore validée, Mesure invalidée, ou Pas de mesure récente |

Gladys n’a pas d’unité de radioactivité : l’unité est dans le nom des fonctionnalités. Une mesure de plus de 2 heures
n’est plus publiée comme actuelle (l’état indique alors « Pas de mesure récente »), comme sur la carte de l’ASNR.

## Widget

**Débit de dose Téléray** : le débit de dose, la moyenne 24 h et le bruit de fond en tuiles, la courbe des 24
dernières heures avec le bruit de fond, et l’heure, l’état et la source de la mesure. Réglages : la balise (vide : la
première ajoutée), et deux interrupteurs pour masquer la courbe ou l’heure et l’état.

## Scènes

- Déclencheur **Débit de dose au-dessus du bruit de fond** : une mesure validée ou en attente dépasse le bruit de fond
  de la balise de la marge choisie (+20, +40, +100 ou +200 nSv/h). Déclenché une fois au franchissement ; la marge
  reste atteinte tant que le débit ne redescend pas 10 nSv/h en dessous. +40 nSv/h est le seuil de la carte de
  l’ASNR. Variables : nom de la balise, débit de dose, bruit de fond, dépassement, heure de la mesure.
- Déclencheur **Débit de dose revenu à la normale** : après un dépassement, le débit est de nouveau à moins de
  10 nSv/h du bruit de fond.
- Action **Obtenir le débit de dose d’une balise** : les dernières valeurs et une phrase toute faite (`summary`) pour
  une notification.

Les appareils donnent aussi leurs valeurs aux conditions de scène habituelles.

## Exemples de scènes

- Me prévenir quand le débit dépasse de 40 nSv/h le bruit de fond : déclencheur « Débit de dose au-dessus du bruit de
  fond », marge +40 nSv/h, puis « Obtenir le débit de dose d’une balise » et une notification avec son résumé.
- Un point hebdomadaire : une scène planifiée, « Obtenir le débit de dose d’une balise », puis un message avec le
  résumé.

## Dépannage

- **« Aucune balise »** : renseignez la position d’une maison (Paramètres → Maisons) ou saisissez une balise dans la
  configuration.
- **« Balises inconnues »** : le numéro ou le nom n’a pas été trouvé ; utilisez le bouton de recherche et copiez le
  numéro.
- **« La carte Téléray ne répond pas »** : les mesures sont relues toutes les 10 minutes.
- **« Pas de mesure récente »** : la balise n’a rien publié depuis 2 heures (maintenance, transmission). Les valeurs
  reviennent avec sa mesure suivante.

## Limites

- L’intégration lit le serveur de la carte publique Téléray, qui n’a pas d’API documentée : il peut changer sans
  préavis.
- Les mesures arrivent 20 à 40 minutes après avoir été prises ; une requête par balise toutes les 10 minutes, la liste
  des balises une fois par jour.
- 5 balises au plus.
- Les noms des fonctionnalités sont fixés à l’ajout de l’appareil ; changer de langue ensuite ne les renomme pas.
