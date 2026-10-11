/** Contenido e identidad editables. No colocar credenciales en archivos públicos. */
export const brand = {
  name: 'Relojería Bacatá',
  signature: 'Tiempo que se siente',
  primaryLogo: '/assets/bacata-logo.png',
  // Completar con los canales comerciales validados antes de publicar.
  contactEmail: '',
  whatsapp: '',
  address: ''
};

/** Una campaña a la vez. Fechas con offset Colombia (-05:00).
 * La campaña cambia la capa editorial; los botones de compra siguen azules.
 * No modifica el logo original. Incluir solo artes aprobados por el diseñador.
 */
export const campaign = {
  enabled: false,
  theme: 'christmas',
  // christmas | friendship | colombia | black-friday | anniversary
  startsAt: '2026-12-01T00:00:00-05:00',
  endsAt: '2026-12-26T00:00:00-05:00',
  headline: 'Un tiempo para regalar.',
  description: 'Una pieza para acompañar sus próximos momentos.',
  label: 'Selección de temporada'
};
export function activeCampaign(now = new Date()) {
  const start = Date.parse(campaign.startsAt);
  const end = Date.parse(campaign.endsAt);
  return campaign.enabled && Number.isFinite(start) && Number.isFinite(end) && start < end && now >= start && now < end ? campaign : null;
}
export const articles = [{
  slug: 'primera-pieza',
  category: 'Educación',
  title: 'Tu primera pieza, con criterio.',
  intro: 'Antes de elegir una marca, piensa en cómo vas a llevar tu reloj.',
  paragraphs: ['El tamaño no es solo un número. El diámetro, el grosor y la distancia entre asas influyen en cómo se siente una pieza en la muñeca. Comparar proporciones y probarla, cuando sea posible, ayuda a decidir.', 'Un movimiento de cuarzo prioriza comodidad y precisión cotidiana. Uno mecánico invita a conocer su funcionamiento y sus cuidados. La elección depende de lo que disfrutas y del uso que quieres darle.', 'Pregunta por la referencia exacta, el estado, el contenido de la entrega y quién responde por la garantía. Una compra que se entiende se disfruta con más tranquilidad.']
}, {
  slug: 'regalar',
  category: 'Momentos',
  title: 'Un regalo que acompaña.',
  intro: 'Una pieza puede hablar de una persona, de su estilo y de los momentos que quieres compartir.',
  paragraphs: ['Observa los accesorios que suele llevar, su rutina y los colores que elige. Una pieza para vestir a diario puede necesitar proporciones y materiales distintos a un reloj para ocasiones especiales.', 'Define un presupuesto y compara referencias dentro de ese rango. El precio importa, pero también la comodidad, el diseño y la claridad de las condiciones de compra.', 'Antes de confirmar, pregunta por el plazo, la presentación y las condiciones de cambio. El cuidado también está en los detalles de la entrega.']
}, {
  slug: 'detalles',
  category: 'Selección',
  title: 'Mira de cerca los detalles.',
  intro: 'La belleza atrae. La información decide.',
  paragraphs: ['Una fotografía amplia ayuda a reconocer proporciones. Las imágenes de esfera, caja, correa y cierre permiten observar acabados y entender la pieza.', 'No confundas una ilustración de campaña con una fotografía de la referencia que vas a recibir. En una ficha de venta, el modelo, la variante y el estado deben corresponder al reloj ofrecido.', 'La procedencia, la documentación disponible y el alcance de la garantía merecen la misma atención que el diseño. Para una compra de mayor valor, pide revisión individual de esos puntos.']
}];
