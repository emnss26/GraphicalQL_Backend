const axios = require("axios");
const { fetchProjects } = require("../../libs/aec/aec.get.project.js");
const { fetchHubs } = require("../../libs/aec/aec.get.hubs.js");
const { fetchAccProjects } = require("../../libs/acc/acc.get.projects.js");

const HUBNAME = process.env.HUBNAME;

/**
 * Función auxiliar para obtener el ID del Hub compatible con Data Management (REST).
 * El ID de GraphQL (urn:adsk.ace...) no funciona en los endpoints de Data Management (b.xxxx).
 */
async function getDmHubId(token, hubName) {
  try {
    const { data } = await axios.get("https://developer.api.autodesk.com/project/v1/hubs", {
      headers: { Authorization: `Bearer ${token}` }
    });
    // Buscamos el hub por nombre (ej: "Abitat Constructora")
    const hub = data.data.find(h => h.attributes.name === hubName);
    return hub ? hub.id : null; // Retorna "b.c8b0..."
  } catch (error) {
    console.warn("Could not fetch DM Hub ID via REST:", error.message);
    return null;
  }
}

const GetAECProjects = async (req, res, next) => {
  try {
    const token = req.cookies?.access_token;

    if (!token) {
      const error = new Error("Authorization token is required");
      error.status = 401;
      error.code = "Unauthorized";
      return next(error);
    }

    // --- PASO 1: OBTENER LOS IDs DE HUB CORRECTOS PARA CADA API ---
    
    // A. Hub ID para AEC (GraphQL)
    const aecHubs = await fetchHubs(token);
    const matchedAecHub = aecHubs.find(hub => hub.name === HUBNAME);
    
    if (!matchedAecHub) {
      const error = new Error(`AEC Hub not found: ${HUBNAME}`);
      error.status = 404;
      return next(error);
    }
    const aecHubId = matchedAecHub.id; // Formato: "urn:adsk.ace:prod.scope..."

    // B. Hub ID para ACC/Data Management (REST)
    // No podemos "adivinar" este ID desde el de AEC, hay que pedirlo.
    const dmHubId = await getDmHubId(token, HUBNAME); // Formato: "b.xxxx-xxxx..."

    console.log(`IDs Resolved: AEC=${aecHubId} | DM=${dmHubId || "Not Found"}`);

    // --- PASO 2: FETCH PARALELO CON IDs DIFERENCIADOS ---
    
    const promises = [
        fetchProjects(token, aecHubId) // Siempre traemos la lista AEC
    ];

    // Solo intentamos traer la lista de ACC si tenemos el ID correcto (el que empieza con b.)
    if (dmHubId) {
        promises.push(fetchAccProjects(token, dmHubId));
    } else {
        console.warn("Skipping ACC Status check because DM Hub ID was not found.");
        promises.push(Promise.resolve([])); // Array vacío si falla el hub de ACC
    }

    const [aecProjects, dmProjects] = await Promise.all(promises);

    // --- PASO 3: CREAR LISTA BLANCA DE PROYECTOS ACTIVOS ---
    
    const activeDmProjectIds = new Set();

    if (dmProjects.length > 0) {
        dmProjects.forEach(dmProj => {
            // Verificamos el status en los atributos de la API REST
            const status = (dmProj.attributes?.status || dmProj.attributes?.extension?.data?.projectStatus || "active").toLowerCase();
            
            // FILTRO: Solo guardamos el ID si está ACTIVO
            if (status === 'active') {
                activeDmProjectIds.add(dmProj.id); // El ID aquí es "b.project_uuid"
            }
        });
    }

    // --- PASO 4: FILTRADO FINAL (MATCH) ---
    
    const finalProjects = aecProjects.filter(aecProj => {
        // Si la lista de DM vino vacía (error de API o Hub), devolvemos todo por seguridad (o nada, según prefieras)
        if (activeDmProjectIds.size === 0) return true;

        // "alternativeIdentifiers.dataManagementAPIProjectId" contiene el ID "b.project_uuid"
        const linkedId = aecProj.alternativeIdentifiers?.dataManagementAPIProjectId;

        // ¿Existe este ID en la lista de proyectos activos de ACC?
        return linkedId && activeDmProjectIds.has(linkedId);
    });

    console.log(`Filtering Result: AEC Total=${aecProjects.length}, Active ACC=${activeDmProjectIds.size} => Final=${finalProjects.length}`);

    return res.status(200).json({
      success: true,
      message: "Active Projects retrieved successfully",
      data: { aecProjects: finalProjects },
      error: null
    });

  } catch (error) {
    console.error("GetAECProjects Error:", error);
    error.code = error.code || "AECProjectsFetchFailed";
    return next(error);
  }
};

module.exports = { GetAECProjects };