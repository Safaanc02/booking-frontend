import PageLegale, { Bloc, AComplete } from "./Page"

/**
 * Obligations d'identification de l'éditeur d'un service en ligne au Maroc
 * (loi 53-05 sur l'échange électronique de données juridiques, loi 31-08 sur
 * la protection du consommateur).
 *
 * Les champs surlignés attendent la constitution de la société. Ils sont
 * laissés visibles plutôt que remplis d'un texte plausible : une mention
 * légale inventée est une fausse déclaration, et elle se retourne contre nous
 * au premier litige.
 */
export default function MentionsLegales() {
  return (
    <PageLegale titre="Mentions légales" maj="23 septembre 2026">
      <p className="rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
        DarZin est en cours de constitution. Les informations surlignées seront
        complétées dès l'immatriculation. Jusque-là, le service fonctionne à
        titre de démonstration et n'accepte pas de réservation réelle.
      </p>

      <Bloc titre="Éditeur du site">
        <p>
          Le site DarZin est édité par <AComplete>raison sociale</AComplete>,{" "}
          <AComplete>forme juridique</AComplete> au capital de{" "}
          <AComplete>capital social</AComplete> dirhams, dont le siège social est
          situé <AComplete>adresse du siège</AComplete>.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>Registre du commerce : <AComplete>numéro RC</AComplete></li>
          <li>Identifiant commun de l'entreprise (ICE) : <AComplete>numéro ICE</AComplete></li>
          <li>Identifiant fiscal : <AComplete>IF</AComplete></li>
          <li>Taxe professionnelle : <AComplete>numéro TP</AComplete></li>
          <li>Directrice de la publication : <AComplete>nom</AComplete></li>
          <li>Contact : <AComplete>adresse électronique de contact</AComplete></li>
        </ul>
      </Bloc>

      <Bloc titre="Hébergement">
        <p>
          Le service est hébergé par Oracle Corporation, dans sa région
          d'infrastructure de Casablanca (Maroc). Les données des utilisateurs
          ne quittent pas le territoire marocain dans le cadre de
          l'exploitation courante du service.
        </p>
      </Bloc>

      <Bloc titre="Nature du service">
        <p>
          DarZin est une plateforme de mise en relation. Elle permet à une
          personne de réserver une prestation auprès d'un établissement de
          beauté indépendant, et à cet établissement de gérer son agenda.
        </p>
        <p>
          DarZin ne réalise aucune prestation de beauté, n'emploie aucun
          praticien et n'encaisse aucun paiement de prestation. Le contrat de
          prestation se noue directement entre la cliente et l'établissement.
        </p>
      </Bloc>

      <Bloc titre="Propriété intellectuelle">
        <p>
          La marque DarZin, le nom de domaine, la charte graphique et le code
          du service sont la propriété de l'éditeur. Les photographies, les
          descriptions et les logos publiés par les établissements restent la
          propriété de ceux-ci, qui en garantissent la titularité et autorisent
          l'éditeur à les afficher pour les besoins du service.
        </p>
      </Bloc>

      <Bloc titre="Signalement">
        <p>
          Tout contenu illicite, toute photographie publiée sans droit ou tout
          avis manifestement faux peut être signalé à{" "}
          <AComplete>adresse de signalement</AComplete>. L'éditeur en accuse
          réception et retire les contenus manifestement illicites.
        </p>
      </Bloc>
    </PageLegale>
  )
}
