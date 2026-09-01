export default function Legal() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold text-stone-900">Mentions légales</h1>
      <div className="mt-6 space-y-6 text-sm leading-relaxed text-stone-700">
        <section>
          <h2 className="font-semibold text-stone-900">Éditeur</h2>
          <p className="mt-1">À compléter : raison sociale, RC, ICE, siège social, directeur de publication.</p>
        </section>
        <section>
          <h2 className="font-semibold text-stone-900">Données personnelles</h2>
          <p className="mt-1">
            Le traitement des données est soumis à la loi 09-08 relative à la protection des
            personnes physiques à l'égard du traitement des données à caractère personnel.
            Une déclaration auprès de la CNDP sera nécessaire avant la mise en production.
          </p>
        </section>
        <section>
          <h2 className="font-semibold text-stone-900">Conditions générales</h2>
          <p className="mt-1">À rédiger : réservation, annulation, responsabilité, litiges.</p>
        </section>
      </div>
    </div>
  )
}
