export const departments = ['Bogotá D.C.','Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas','Caquetá','Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare','Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada'];
export const customerDefaults={full_name:'',email:'',phone:'',country:'CO',department:'',city:'',address:'',notes:''};
export function customerDestination(customer) {
  return customer.department === 'Bogotá D.C.' ? {zone:'bogota',city:'Bogotá'} : {zone:'national',city:customer.city};
}
export function validateCustomer(input) {
  if(!input || typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!Object.hasOwn(customerDefaults,key)))throw Error('Datos del comprador inválidos');
  const result={};
  for(const [key,max] of Object.entries({full_name:120,email:254,phone:30,country:2,department:80,city:100,address:300,notes:2000})) {
    if(typeof input[key]!=='string'||input[key].length>max||(key==='notes'?/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/:/[\u0000-\u001f]/).test(input[key]))throw Error('Revisa los datos de contacto y entrega');
    result[key]=input[key].trim();
  }
  if(result.full_name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)||!/^\+?[\d ()-]+$/.test(result.phone))throw Error('Completa nombre, correo y teléfono válidos');
  result.phone=result.phone.replace(/[ ()+-]/g,'');
  if(!/^(?:57)?\d{10}$/.test(result.phone))throw Error('El teléfono debe tener 10 dígitos, con indicativo 57 opcional');
  if(result.country!=='CO'||!departments.includes(result.department)||result.address.length<5||result.city.length<2)throw Error('Completa país, departamento, ciudad y dirección de Colombia');
  if(!/^[\p{L}\p{M} .'-]+$/u.test(result.city))throw Error('Ciudad inválida');
  const normalized=result.city.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
  const bogota=['bogota','bogotadc','santafedebogota','santafedebogotadc'].includes(normalized);
  if((result.department==='Bogotá D.C.')!==bogota)throw Error('Para Bogotá selecciona el departamento Bogotá D.C.; otras ciudades deben usar su departamento');
  if(bogota)result.city='Bogotá';
  return result;
}
