export const fulfillmentLabels={pending:'Por confirmar',confirmed:'Confirmado',preparing:'En preparación',shipped:'Enviado',delivered:'Entregado'};
export const fulfillmentStates=Object.keys(fulfillmentLabels);
export function nextFulfillment(status) {return fulfillmentStates[fulfillmentStates.indexOf(status)+1] || null;}
