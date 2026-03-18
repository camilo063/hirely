import { TipoContrato } from '../types/contrato.types';

// ─── PLANTILLAS HTML POR TIPO DE CONTRATO ────────────────────

const ESTILOS_BASE = `
  <style>
    body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 13px; line-height: 1.6; color: #1a1a1a; }
    .contrato { max-width: 750px; margin: 0 auto; padding: 40px 50px; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { font-size: 18px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 5px; }
    .header h2 { font-size: 14px; font-weight: normal; color: #444; }
    .clausula { margin-bottom: 20px; }
    .clausula h3 { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .clausula p { text-align: justify; margin-bottom: 8px; }
    .datos-tabla { width: 100%; border-collapse: collapse; margin: 15px 0; }
    .datos-tabla td { padding: 6px 10px; border: 1px solid #ddd; font-size: 12px; }
    .datos-tabla td:first-child { font-weight: bold; width: 40%; background: #f8f8f8; }
    .firmas { margin-top: 60px; display: flex; justify-content: space-between; }
    .firma-bloque { text-align: center; width: 45%; }
    .firma-linea { border-top: 1px solid #000; margin-top: 60px; padding-top: 8px; font-size: 12px; }
    .lugar-fecha { text-align: right; margin-bottom: 30px; font-style: italic; font-size: 12px; }
  </style>
`;

const PLANTILLA_PRESTACION_SERVICIOS = `${ESTILOS_BASE}
<div class="contrato">
  <div class="header">
    <h1>Contrato de Prestación de Servicios</h1>
    <h2>{{empresa_nombre}}</h2>
  </div>

  <p class="lugar-fecha">{{ciudad_contrato}}, {{fecha_contrato}}</p>

  <div class="clausula">
    <p>Entre <strong>{{empresa_nombre}}</strong>, identificada con NIT <strong>{{empresa_nit}}</strong>, representada legalmente por <strong>{{empresa_representante}}</strong>, en adelante EL CONTRATANTE, y <strong>{{nombre_completo}}</strong>, identificado(a) con cédula de ciudadanía No. <strong>{{cedula}}</strong>, domiciliado(a) en <strong>{{direccion}}</strong>, en adelante EL CONTRATISTA, se celebra el presente contrato de prestación de servicios profesionales, que se regirá por las siguientes cláusulas:</p>
  </div>

  <div class="clausula">
    <h3>Primera - Objeto</h3>
    <p>EL CONTRATISTA se obliga para con EL CONTRATANTE a ejecutar de manera independiente y autónoma los servicios de <strong>{{objeto_contrato}}</strong>, en calidad de <strong>{{cargo}}</strong>.</p>
  </div>

  <div class="clausula">
    <h3>Segunda - Obligaciones del Contratista</h3>
    <p>{{obligaciones}}</p>
    <p>EL CONTRATISTA se compromete a ejecutar las actividades con diligencia, eficiencia y oportunidad, cumpliendo con los estándares de calidad requeridos.</p>
  </div>

  <div class="clausula">
    <h3>Tercera - Duración</h3>
    <p>El presente contrato tendrá una duración de <strong>{{duracion}}</strong>, contados a partir del <strong>{{fecha_inicio}}</strong>{{fecha_fin}}, prorrogable de mutuo acuerdo entre las partes.</p>
  </div>

  <div class="clausula">
    <h3>Cuarta - Honorarios</h3>
    <p>EL CONTRATANTE pagará a EL CONTRATISTA la suma de <strong>{{salario}} COP</strong> {{salario_letras}} mensuales, como contraprestación por los servicios prestados. Los pagos se realizarán dentro de los primeros cinco (5) días hábiles del mes siguiente al periodo facturado, previa presentación del informe de actividades y cuenta de cobro correspondiente.</p>
  </div>

  <div class="clausula">
    <h3>Quinta - Autonomía e Independencia</h3>
    <p>EL CONTRATISTA ejecutará el objeto del presente contrato con plena autonomía técnica, administrativa y financiera, utilizando sus propios medios y recursos. El presente contrato no genera relación laboral ni dependencia entre las partes, por lo que EL CONTRATISTA asume la responsabilidad del pago de sus obligaciones tributarias y aportes al Sistema de Seguridad Social Integral.</p>
  </div>

  <div class="clausula">
    <h3>Sexta - Confidencialidad</h3>
    <p>EL CONTRATISTA se obliga a mantener absoluta reserva y confidencialidad respecto de toda la información a la que tenga acceso con ocasión de la ejecución del presente contrato. Esta obligación subsistirá aún después de terminado el contrato.</p>
  </div>

  <div class="clausula">
    <h3>Séptima - Terminación</h3>
    <p>El presente contrato podrá darse por terminado: a) Por mutuo acuerdo de las partes; b) Por vencimiento del plazo pactado; c) Por incumplimiento de las obligaciones por cualquiera de las partes, previo requerimiento escrito con quince (15) días de anticipación; d) Por las demás causales previstas en la ley.</p>
  </div>

  <div class="clausula">
    <h3>Octava - Cesión</h3>
    <p>EL CONTRATISTA no podrá ceder total ni parcialmente el presente contrato sin autorización previa y escrita de EL CONTRATANTE.</p>
  </div>

  {{clausulas_adicionales}}

  <div class="clausula">
    <h3>Datos de Contacto del Contratista</h3>
    <table class="datos-tabla">
      <tr><td>Nombre completo</td><td>{{nombre_completo}}</td></tr>
      <tr><td>Cédula</td><td>{{cedula}}</td></tr>
      <tr><td>Dirección</td><td>{{direccion}}</td></tr>
      <tr><td>Teléfono</td><td>{{telefono}}</td></tr>
      <tr><td>Correo electrónico</td><td>{{correo}}</td></tr>
      <tr><td>Ciudad</td><td>{{ciudad}}</td></tr>
    </table>
  </div>

  <p>En señal de conformidad, las partes suscriben el presente contrato en dos (2) ejemplares del mismo tenor y valor, en {{ciudad_contrato}}, a los {{fecha_contrato}}.</p>

  <div class="firmas">
    <div class="firma-bloque">
      <div class="firma-linea">
        <strong>EL CONTRATANTE</strong><br/>
        {{empresa_representante}}<br/>
        Representante Legal<br/>
        {{empresa_nombre}}<br/>
        NIT: {{empresa_nit}}
      </div>
    </div>
    <div class="firma-bloque">
      <div class="firma-linea">
        <strong>EL CONTRATISTA</strong><br/>
        {{nombre_completo}}<br/>
        C.C. {{cedula}}
      </div>
    </div>
  </div>
</div>`;

const PLANTILLA_HORAS_DEMANDA = `${ESTILOS_BASE}
<div class="contrato">
  <div class="header">
    <h1>Contrato de Servicios por Horas y Demanda</h1>
    <h2>{{empresa_nombre}}</h2>
  </div>

  <p class="lugar-fecha">{{ciudad_contrato}}, {{fecha_contrato}}</p>

  <div class="clausula">
    <p>Entre <strong>{{empresa_nombre}}</strong>, identificada con NIT <strong>{{empresa_nit}}</strong>, representada legalmente por <strong>{{empresa_representante}}</strong>, en adelante EL CONTRATANTE, y <strong>{{nombre_completo}}</strong>, identificado(a) con cédula de ciudadanía No. <strong>{{cedula}}</strong>, domiciliado(a) en <strong>{{direccion}}</strong>, en adelante EL PRESTADOR, se celebra el presente contrato de prestación de servicios por horas, bajo las siguientes cláusulas:</p>
  </div>

  <div class="clausula">
    <h3>Primera - Objeto</h3>
    <p>EL PRESTADOR se obliga a prestar servicios profesionales de <strong>{{objeto_contrato}}</strong> en calidad de <strong>{{cargo}}</strong>, bajo la modalidad de horas y demanda, de acuerdo con los requerimientos específicos que EL CONTRATANTE le asigne.</p>
  </div>

  <div class="clausula">
    <h3>Segunda - Modalidad de Prestación</h3>
    <p>Los servicios serán prestados bajo la modalidad <strong>{{modalidad}}</strong>. EL PRESTADOR ejecutará las tareas asignadas de manera independiente, reportando el avance y las horas dedicadas a cada tarea mediante los mecanismos que EL CONTRATANTE disponga para tal fin.</p>
  </div>

  <div class="clausula">
    <h3>Tercera - Duración</h3>
    <p>El presente contrato tendrá vigencia a partir del <strong>{{fecha_inicio}}</strong>{{duracion}}. Las partes podrán darlo por terminado en cualquier momento mediante aviso escrito con diez (10) días hábiles de anticipación.</p>
  </div>

  <div class="clausula">
    <h3>Cuarta - Valor y Forma de Pago</h3>
    <p>EL CONTRATANTE pagará a EL PRESTADOR una tarifa de <strong>{{salario}} COP por hora</strong> efectivamente trabajada. El pago se realizará de forma quincenal o mensual, según acuerden las partes, previa presentación del reporte de horas y aprobación por parte de EL CONTRATANTE.</p>
    <p>El reporte de horas deberá incluir: fecha, descripción de actividades realizadas, y número de horas dedicadas a cada actividad.</p>
  </div>

  <div class="clausula">
    <h3>Quinta - Autonomía</h3>
    <p>EL PRESTADOR ejecutará los servicios con plena autonomía técnica y administrativa. El presente contrato no genera relación laboral entre las partes. EL PRESTADOR es responsable de sus obligaciones tributarias y de seguridad social.</p>
  </div>

  <div class="clausula">
    <h3>Sexta - Propiedad Intelectual</h3>
    <p>Todo trabajo, desarrollo, documento o material producido por EL PRESTADOR en ejecución del presente contrato será de propiedad exclusiva de EL CONTRATANTE.</p>
  </div>

  <div class="clausula">
    <h3>Séptima - Confidencialidad</h3>
    <p>EL PRESTADOR se compromete a mantener estricta confidencialidad sobre toda información técnica, comercial o estratégica a la que tenga acceso durante la ejecución del contrato. Esta obligación se mantendrá vigente por un periodo de dos (2) años después de la terminación del contrato.</p>
  </div>

  <div class="clausula">
    <h3>Octava - Terminación</h3>
    <p>El contrato podrá terminarse por: a) Mutuo acuerdo; b) Aviso escrito con diez (10) días hábiles de anticipación; c) Incumplimiento de obligaciones; d) Las demás causales de ley.</p>
  </div>

  {{clausulas_adicionales}}

  <div class="clausula">
    <h3>Datos de Contacto del Prestador</h3>
    <table class="datos-tabla">
      <tr><td>Nombre completo</td><td>{{nombre_completo}}</td></tr>
      <tr><td>Cédula</td><td>{{cedula}}</td></tr>
      <tr><td>Dirección</td><td>{{direccion}}</td></tr>
      <tr><td>Teléfono</td><td>{{telefono}}</td></tr>
      <tr><td>Correo electrónico</td><td>{{correo}}</td></tr>
    </table>
  </div>

  <p>Para constancia se firma en {{ciudad_contrato}}, a los {{fecha_contrato}}.</p>

  <div class="firmas">
    <div class="firma-bloque">
      <div class="firma-linea">
        <strong>EL CONTRATANTE</strong><br/>
        {{empresa_representante}}<br/>
        Representante Legal<br/>
        {{empresa_nombre}}<br/>
        NIT: {{empresa_nit}}
      </div>
    </div>
    <div class="firma-bloque">
      <div class="firma-linea">
        <strong>EL PRESTADOR</strong><br/>
        {{nombre_completo}}<br/>
        C.C. {{cedula}}
      </div>
    </div>
  </div>
</div>`;

const PLANTILLA_LABORAL = `${ESTILOS_BASE}
<div class="contrato">
  <div class="header">
    <h1>Contrato Individual de Trabajo</h1>
    <h2>{{empresa_nombre}}</h2>
  </div>

  <p class="lugar-fecha">{{ciudad_contrato}}, {{fecha_contrato}}</p>

  <div class="clausula">
    <p>Entre <strong>{{empresa_nombre}}</strong>, identificada con NIT <strong>{{empresa_nit}}</strong>, con domicilio en <strong>{{empresa_direccion}}</strong>, representada legalmente por <strong>{{empresa_representante}}</strong>, en adelante EL EMPLEADOR, y <strong>{{nombre_completo}}</strong>, identificado(a) con cédula de ciudadanía No. <strong>{{cedula}}</strong>, domiciliado(a) en <strong>{{direccion}}</strong>, ciudad de <strong>{{ciudad}}</strong>, en adelante EL TRABAJADOR, se celebra el presente contrato individual de trabajo, regido por el Código Sustantivo del Trabajo y las siguientes cláusulas:</p>
  </div>

  <div class="clausula">
    <h3>Primera - Objeto</h3>
    <p>EL EMPLEADOR contrata los servicios personales de EL TRABAJADOR para desempeñar el cargo de <strong>{{cargo}}</strong>, y las demás funciones que le sean asignadas por EL EMPLEADOR, compatibles con la naturaleza del cargo.</p>
  </div>

  <div class="clausula">
    <h3>Segunda - Duración</h3>
    <p>El presente contrato tendrá una duración de <strong>{{duracion}}</strong>, contado a partir del <strong>{{fecha_inicio}}</strong>{{fecha_fin}}.</p>
  </div>

  <div class="clausula">
    <h3>Tercera - Periodo de Prueba</h3>
    <p>Las partes acuerdan un periodo de prueba de <strong>{{periodo_prueba}}</strong>, durante el cual cualquiera de las partes podrá dar por terminado el contrato sin previo aviso y sin indemnización alguna.</p>
  </div>

  <div class="clausula">
    <h3>Cuarta - Jornada de Trabajo</h3>
    <p>La jornada laboral será de <strong>{{jornada}}</strong>, con horario de <strong>{{horario}}</strong>. Las horas extras y trabajo en días festivos se regularán conforme a la legislación laboral colombiana vigente.</p>
  </div>

  <div class="clausula">
    <h3>Quinta - Lugar de Trabajo</h3>
    <p>EL TRABAJADOR prestará sus servicios en modalidad <strong>{{modalidad}}</strong>{{ubicacion_trabajo}}. EL EMPLEADOR podrá modificar el lugar de trabajo dentro de la misma ciudad, cuando las necesidades del servicio lo requieran.</p>
  </div>

  <div class="clausula">
    <h3>Sexta - Salario</h3>
    <p>EL EMPLEADOR pagará a EL TRABAJADOR un salario mensual de <strong>{{salario}} COP</strong> {{salario_letras}}, pagadero en periodos quincenales. Este salario incluye la remuneración por el trabajo en los días de descanso obligatorio de que tratan los artículos 172 y 173 del Código Sustantivo del Trabajo.</p>
  </div>

  <div class="clausula">
    <h3>Séptima - Prestaciones Sociales</h3>
    <p>EL TRABAJADOR tendrá derecho a las prestaciones sociales establecidas por la ley colombiana, incluyendo: cesantías, intereses sobre cesantías, prima de servicios, vacaciones, y las demás que correspondan de acuerdo con la legislación vigente.</p>
  </div>

  <div class="clausula">
    <h3>Octava - Seguridad Social</h3>
    <p>EL EMPLEADOR afiliará a EL TRABAJADOR al Sistema de Seguridad Social Integral (salud, pensión y riesgos laborales) y realizará los aportes correspondientes conforme a la ley.</p>
  </div>

  <div class="clausula">
    <h3>Novena - Obligaciones del Trabajador</h3>
    <p>EL TRABAJADOR se obliga a: a) Cumplir con las funciones inherentes a su cargo; b) Observar el reglamento interno de trabajo; c) Guardar confidencialidad sobre la información de EL EMPLEADOR; d) No realizar competencia desleal; e) Cumplir con las políticas de la empresa; f) Las demás que establezca la ley y el reglamento interno.</p>
  </div>

  <div class="clausula">
    <h3>Décima - Obligaciones del Empleador</h3>
    <p>EL EMPLEADOR se obliga a: a) Pagar la remuneración pactada en las condiciones y plazos convenidos; b) Suministrar los elementos necesarios para el desempeño de las funciones; c) Cumplir con las normas de seguridad y salud en el trabajo; d) Afiliar al trabajador al Sistema de Seguridad Social; e) Las demás establecidas por la ley.</p>
  </div>

  <div class="clausula">
    <h3>Undécima - Terminación</h3>
    <p>El presente contrato podrá terminarse por las justas causas establecidas en los artículos 62 y 63 del Código Sustantivo del Trabajo, por mutuo acuerdo, por vencimiento del plazo pactado, o por las demás causales legales. La parte que desee terminar el contrato sin justa causa deberá pagar la indemnización correspondiente conforme al artículo 64 del Código Sustantivo del Trabajo.</p>
  </div>

  <div class="clausula">
    <h3>Duodécima - Confidencialidad</h3>
    <p>EL TRABAJADOR se obliga a mantener absoluta reserva sobre toda información confidencial, secretos comerciales y propiedad intelectual de EL EMPLEADOR. Esta obligación subsistirá por un periodo de dos (2) años después de la terminación del contrato.</p>
  </div>

  {{clausulas_adicionales}}

  <div class="clausula">
    <h3>Datos del Trabajador</h3>
    <table class="datos-tabla">
      <tr><td>Nombre completo</td><td>{{nombre_completo}}</td></tr>
      <tr><td>Cédula de ciudadanía</td><td>{{cedula}}</td></tr>
      <tr><td>Dirección</td><td>{{direccion}}</td></tr>
      <tr><td>Ciudad</td><td>{{ciudad}}</td></tr>
      <tr><td>Teléfono</td><td>{{telefono}}</td></tr>
      <tr><td>Correo electrónico</td><td>{{correo}}</td></tr>
    </table>
  </div>

  <p>En constancia de lo anterior, las partes firman el presente contrato en dos (2) ejemplares del mismo tenor, en {{ciudad_contrato}}, a los {{fecha_contrato}}.</p>

  <div class="firmas">
    <div class="firma-bloque">
      <div class="firma-linea">
        <strong>EL EMPLEADOR</strong><br/>
        {{empresa_representante}}<br/>
        Representante Legal<br/>
        {{empresa_nombre}}<br/>
        NIT: {{empresa_nit}}
      </div>
    </div>
    <div class="firma-bloque">
      <div class="firma-linea">
        <strong>EL TRABAJADOR</strong><br/>
        {{nombre_completo}}<br/>
        C.C. {{cedula}}
      </div>
    </div>
  </div>
</div>`;

export const PLANTILLAS_CONTRATO_DEFAULT: Record<TipoContrato, { nombre: string; contenido_html: string }> = {
  prestacion_servicios: {
    nombre: 'Contrato de Prestación de Servicios (Default)',
    contenido_html: PLANTILLA_PRESTACION_SERVICIOS,
  },
  horas_demanda: {
    nombre: 'Contrato por Horas y Demanda (Default)',
    contenido_html: PLANTILLA_HORAS_DEMANDA,
  },
  laboral: {
    nombre: 'Contrato Laboral Individual (Default)',
    contenido_html: PLANTILLA_LABORAL,
  },
};

export function renderPlantillaContrato(
  template: string,
  datos: Record<string, unknown>
): string {
  let html = template;
  for (const [key, value] of Object.entries(datos)) {
    if (value === null || value === undefined) continue;
    const strValue = typeof value === 'number'
      ? new Intl.NumberFormat('es-CO').format(value)
      : String(value);
    html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), strValue);
  }
  // Clean any remaining unreplaced variables
  html = html.replace(/\{\{[a-z_]+\}\}/g, '');
  return html;
}
