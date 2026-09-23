import PageLegale, { Bloc, AComplete } from "./Page"

/**
 * Politique de confidentialité, écrite à partir de ce que l'application
 * collecte réellement — schéma de base en main, et non d'un modèle générique.
 *
 * Deux points méritent d'être dits noir sur blanc parce qu'ils sont vrais et
 * rarement écrits ailleurs : les notes qu'un salon prend sur une cliente lui
 * appartiennent et ne sortent jamais de ce salon ; et l'annulation par lien
 * signé évite d'exiger un compte pour renoncer à un rendez-vous.
 */
export default function Confidentialite() {
  return (
    <PageLegale titre="Données personnelles" maj="23 septembre 2026">
      <p className="rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
        Le traitement sera déclaré à la CNDP avant l'ouverture du service à des
        établissements réels. Le récépissé de déclaration figurera ici.
      </p>

      <Bloc titre="Qui traite vos données">
        <p>
          <AComplete>raison sociale</AComplete>, éditrice de DarZin, est
          responsable du traitement au sens de la loi 09-08 relative à la
          protection des personnes physiques à l'égard du traitement des
          données à caractère personnel.
        </p>
        <p>
          Chaque établissement inscrit est responsable, de son côté, des
          données qu'il saisit sur ses propres clientes : coordonnées relevées
          au téléphone, notes de suivi. DarZin les héberge pour son compte.
        </p>
      </Bloc>

      <Bloc titre="Ce que nous collectons, et pourquoi">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-stone-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Donnée</th>
                <th className="py-2 pr-4 font-medium">Pourquoi</th>
                <th className="py-2 font-medium">Combien de temps</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 align-top">
              <tr>
                <td className="py-2 pr-4">Nom, prénom, adresse électronique</td>
                <td className="py-2 pr-4">Identifier votre compte, vous envoyer vos confirmations</td>
                <td className="py-2">Tant que le compte existe</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Numéro de téléphone</td>
                <td className="py-2 pr-4">Permettre au salon de vous joindre en cas d'imprévu</td>
                <td className="py-2">Tant que le compte existe</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Rendez-vous : date, prestation, praticien, montant</td>
                <td className="py-2 pr-4">Tenir l'agenda, et votre historique</td>
                <td className="py-2">3 ans après le dernier rendez-vous</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Note de suivi écrite par le salon</td>
                <td className="py-2 pr-4">Permettre au salon de vous reconnaître d'une visite à l'autre</td>
                <td className="py-2">Tant que vous êtes cliente de ce salon</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Avis et notes</td>
                <td className="py-2 pr-4">Renseigner les autres clientes</td>
                <td className="py-2">Publiés tant que le salon est référencé</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Journaux techniques du serveur</td>
                <td className="py-2 pr-4">Sécurité, diagnostic de panne</td>
                <td className="py-2">15 jours</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Bloc>

      <Bloc titre="Ce que nous ne faisons pas">
        <ul className="ml-5 list-disc space-y-1">
          <li>Nous ne vendons ni ne louons aucune donnée.</li>
          <li>Nous n'affichons aucune publicité ciblée.</li>
          <li>Nous ne déposons aucun traceur publicitaire.</li>
          <li>
            Nous ne demandons aucune donnée de santé. Si vous en confiez une à
            un salon pour les besoins d'une prestation, elle reste dans ce
            salon.
          </li>
        </ul>
      </Bloc>

      <Bloc titre="Le cloisonnement entre salons">
        <p>
          Un établissement ne voit que les clientes qui ont pris rendez-vous
          chez lui, et que leur historique chez lui. Les notes de suivi qu'il
          écrit ne sont visibles d'aucun autre établissement, quelle que soit
          la cliente. Cette séparation est appliquée par le serveur, à chaque
          requête, et non par l'interface.
        </p>
      </Bloc>

      <Bloc titre="Qui d'autre y a accès">
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>L'établissement où vous réservez</strong> : vos coordonnées
            et vos rendez-vous chez lui.
          </li>
          <li>
            <strong>Notre hébergeur</strong>, Oracle, région de Casablanca, qui
            héberge sans accéder au contenu.
          </li>
          <li>
            <strong>Notre prestataire d'envoi de messages</strong>, pour vous
            transmettre confirmations et rappels.
          </li>
        </ul>
        <p>Aucun autre tiers.</p>
      </Bloc>

      <Bloc titre="Vos droits">
        <p>
          Vous disposez d'un droit d'accès, de rectification et d'opposition, et
          d'un droit à l'effacement de vos données. Écrivez à{" "}
          <AComplete>adresse de contact vie privée</AComplete> : nous répondons
          sous trente jours.
        </p>
        <p>
          L'effacement d'un compte supprime vos coordonnées et vos notes de
          suivi. Les rendez-vous passés sont conservés sous forme anonymisée :
          ils appartiennent aussi à la comptabilité du salon, qui doit pouvoir
          justifier de son activité.
        </p>
        <p>
          Vous pouvez également saisir la Commission nationale de contrôle de la
          protection des données à caractère personnel (CNDP).
        </p>
      </Bloc>

      <Bloc titre="Cookies">
        <p>
          Le site ne dépose que ce qui lui est strictement nécessaire : le jeton
          qui maintient votre session ouverte, et une marque locale indiquant
          que vous vous êtes déjà connectée, pour ne pas vous réafficher la page
          d'accueil publique. Aucun traceur de mesure d'audience ni de
          publicité n'est utilisé — c'est aussi pourquoi aucun bandeau de
          consentement ne vous est imposé.
        </p>
      </Bloc>
    </PageLegale>
  )
}
