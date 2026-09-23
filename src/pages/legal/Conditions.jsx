import PageLegale, { Bloc, AComplete } from "./Page"

/**
 * Conditions d'utilisation, côté cliente et côté établissement.
 *
 * Le point qui compte est celui de la responsabilité : DarZin met en relation,
 * il ne coiffe personne. Une cliente mécontente de sa couleur n'a pas de
 * recours contre la plateforme, et il vaut mieux l'avoir écrit avant le
 * premier litige que de le découvrir pendant.
 *
 * Le second point qui compte est la réversibilité : un salon qui sait qu'il
 * peut partir avec ses données signe plus facilement que celui qui se demande
 * s'il sera pris au piège. C'est un argument commercial autant qu'une clause.
 */
export default function Conditions() {
  return (
    <PageLegale titre="Conditions d'utilisation" maj="23 septembre 2026">
      <p className="rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
        Ce texte est un projet, rédigé à partir du fonctionnement réel du
        service. Il doit être relu par un juriste avant toute signature avec un
        établissement.
      </p>

      <Bloc titre="Objet">
        <p>
          DarZin met en relation des personnes cherchant une prestation de
          beauté et des établissements indépendants. L'utilisation du service
          vaut acceptation des présentes conditions.
        </p>
      </Bloc>

      <Bloc titre="Réserver, annuler, déplacer">
        <p>
          Une réservation confirmée engage la cliente à se présenter, et
          l'établissement à la recevoir.
        </p>
        <p>
          Chaque établissement fixe son délai de prévenance. En deçà de ce
          délai, le rendez-vous ne peut plus être ni annulé ni déplacé depuis
          le site : il faut appeler le salon. Le délai applicable est affiché
          sur la réservation et rappelé dans le courriel de confirmation.
        </p>
        <p>
          Un lien d'annulation figure dans chaque confirmation. Il fonctionne
          sans connexion : exiger un mot de passe pour renoncer à un rendez-vous
          produit des absences, pas des annulations.
        </p>
      </Bloc>

      <Bloc titre="Absences">
        <p>
          Un établissement peut signaler qu'une cliente ne s'est pas présentée.
          Ce signalement n'est visible que de cet établissement. Il ne donne
          lieu à aucun prélèvement : DarZin n'encaisse aucun paiement.
        </p>
      </Bloc>

      <Bloc titre="Paiement">
        <p>
          Les prestations se règlent directement auprès de l'établissement, sur
          place. Les prix affichés sont ceux communiqués par l'établissement,
          toutes taxes comprises, et figés au moment de la réservation : une
          hausse de tarif ultérieure ne s'applique pas à un rendez-vous déjà
          pris.
        </p>
      </Bloc>

      <Bloc titre="Avis">
        <p>
          Seule une personne dont le rendez-vous a été honoré peut déposer un
          avis, et une seule fois par rendez-vous. L'établissement dispose d'un
          droit de réponse public.
        </p>
        <p>
          Sont retirés les avis injurieux, diffamatoires, hors sujet ou
          contenant des données personnelles de tiers. Un avis n'est jamais
          retiré au seul motif qu'il est négatif.
        </p>
      </Bloc>

      <Bloc titre="Responsabilité">
        <p>
          La prestation est réalisée par l'établissement, sous sa seule
          responsabilité. DarZin n'est pas partie au contrat de prestation et ne
          répond ni de sa qualité, ni de son exécution, ni des dommages qui en
          résulteraient.
        </p>
        <p>
          DarZin répond en revanche du fonctionnement de son service :
          disponibilité raisonnable, exactitude des créneaux proposés,
          acheminement des confirmations. Le service peut être interrompu pour
          maintenance, et l'éditeur s'efforce de prévenir les établissements
          concernés.
        </p>
      </Bloc>

      <Bloc titre="Engagements de l'établissement">
        <ul className="ml-5 list-disc space-y-1">
          <li>Tenir son agenda à jour, et honorer les rendez-vous acceptés.</li>
          <li>Afficher des prix et des durées exacts.</li>
          <li>Ne publier que des photographies dont il détient les droits.</li>
          <li>
            N'utiliser les coordonnées de ses clientes que pour les besoins de
            leurs rendez-vous.
          </li>
          <li>Disposer des autorisations et assurances requises par son activité.</li>
        </ul>
      </Bloc>

      <Bloc titre="Départ d'un établissement">
        <p>
          Un établissement peut quitter DarZin à tout moment. Il obtient sur
          demande, dans un format exploitable, la liste de ses clientes, leurs
          coordonnées et l'historique de ses rendez-vous. Sa fiche cesse alors
          d'être publiée.
        </p>
        <p>
          Les rendez-vous déjà pris par des clientes sont honorés ou annulés par
          l'établissement, qui prévient les personnes concernées.
        </p>
      </Bloc>

      <Bloc titre="Suspension">
        <p>
          L'éditeur peut suspendre un compte qui ne respecte pas ces conditions,
          après avertissement — sauf urgence manifeste : usurpation d'identité,
          contenu illicite, mise en danger de clientes.
        </p>
      </Bloc>

      <Bloc titre="Droit applicable">
        <p>
          Les présentes conditions sont régies par le droit marocain. À défaut
          de règlement amiable, le litige relève des tribunaux compétents de{" "}
          <AComplete>ville du siège</AComplete>.
        </p>
      </Bloc>
    </PageLegale>
  )
}
