// ModulosManager.js
// Módulo independiente para gestionar módulos, ciclos y cálculos de umbrales

class ModulosManager {
    constructor() {
        this.ciclos = [];
        this.cicloActual = null;
        this.modulosData = {};
        this.sesionesPorModulo = {};
        this.umbralesPorModulo = {};
        this.moduloMapping = {};
        
        // Constantes
        this.SESION_MINUTOS = 50;
        
        // Event listeners
        this.onCicloChangeCallbacks = [];
    }

    /**
     * Carga los datos de ciclos desde el objeto datosCiclos
     * @param {Array} ciclosData - Array de objetos con información de ciclos
     */
    cargarCiclos(ciclosData) {
        this.ciclos = ciclosData;
        
        // Seleccionar el primer ciclo por defecto
        if (this.ciclos.length > 0) {
            this.seleccionarCiclo(this.ciclos[0].nomeCiclo);
        }
    }

    /**
     * Selecciona un ciclo por su nombre
     * @param {string} nomeCiclo - Nombre del ciclo a seleccionar
     * @returns {boolean} - true si se seleccionó correctamente
     */
    seleccionarCiclo(nomeCiclo) {
        const ciclo = this.ciclos.find(c => c.nomeCiclo === nomeCiclo);
        if (!ciclo) {
            console.error(`Ciclo no encontrado: ${nomeCiclo}`);
            return false;
        }

        this.cicloActual = ciclo;
        this._cargarModulosDelCiclo(ciclo);
        
        // Notificar a los listeners
        this.onCicloChangeCallbacks.forEach(callback => callback(this.cicloActual));
        
        return true;
    }

    /**
     * Obtiene la lista de ciclos disponibles
     * @returns {Array} - Lista de ciclos con nombre y código
     */
    getCiclosDisponibles() {
        return this.ciclos.map(ciclo => ({
            codigo: ciclo.codigoCiclo,
            nome: ciclo.nomeCiclo,
            siglas: ciclo.siglasCiclo
        }));
    }

    /**
     * Obtiene el ciclo actualmente seleccionado
     * @returns {Object|null} - Ciclo actual o null si no hay
     */
    getCicloActual() {
        return this.cicloActual;
    }

    /**
     * Obtiene todos los módulos del ciclo actual
     * @returns {Object} - Objeto con datos de módulos
     */
    getModulosData() {
        return { ...this.modulosData };
    }

    /**
     * Obtiene las sesiones por módulo
     * @returns {Object} - Mapa módulo -> sesiones totales
     */
    getSesionesPorModulo() {
        return { ...this.sesionesPorModulo };
    }

    /**
     * Obtiene los umbrales por módulo
     * @returns {Object} - Mapa módulo -> {umbral6, umbral4}
     */
    getUmbralesPorModulo() {
        return { ...this.umbralesPorModulo };
    }

    /**
     * Obtiene el mapping de nombres normalizados
     * @returns {Object} - Mapa nombre_normalizado -> nombre_real
     */
    getModuloMapping() {
        return { ...this.moduloMapping };
    }

    /**
     * Calcula las sesiones totales a partir de horas
     * @param {number} horas - Horas totales del módulo
     * @returns {number} - Sesiones totales (base 50 minutos)
     */
    calcularSesiones(horas) {
        return (horas * 60) / this.SESION_MINUTOS;
    }

    /**
     * Calcula el umbral para un porcentaje dado
     * @param {number} sesionesTotales - Total de sesiones
     * @param {number} porcentaje - Porcentaje (ej: 6 para 6%)
     * @returns {number} - Umbral (floor(sesiones * porcentaje/100) + 1)
     */
    calcularUmbral(sesionesTotales, porcentaje) {
        return Math.floor(sesionesTotales * (porcentaje / 100)) + 1;
    }

    /**
     * Normaliza el nombre de un módulo para búsquedas
     * @param {string} name - Nombre original
     * @returns {string} - Nombre normalizado
     */
    normalizarNombreModulo(name) {
        if (!name) return '';

        let normalized = name
            .toLowerCase()
            .replace(/[áàäâ]/g, 'a')
            .replace(/[éèëê]/g, 'e')
            .replace(/[íìïî]/g, 'i')
            .replace(/[óòöô]/g, 'o')
            .replace(/[úùüû]/g, 'u')
            .replace(/ñ/g, 'n')
            .replace(/ç/g, 'c')
            .replace(/[\(\)]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        return normalized;
    }

    /**
     * Busca un módulo en el mapping por nombre aproximado
     * @param {string} moduloName - Nombre del módulo a buscar
     * @returns {string|null} - Nombre real del módulo o null si no se encuentra
     */
    buscarModuloEnMapping(moduloName) {
        if (!moduloName) return null;

        // Búsqueda directa
        if (this.sesionesPorModulo[moduloName]) {
            return moduloName;
        }

        // Búsqueda normalizada
        const normalized = this.normalizarNombreModulo(moduloName);
        if (this.moduloMapping[normalized]) {
            return this.moduloMapping[normalized];
        }

        // Búsqueda por inclusión
        for (let [key, value] of Object.entries(this.moduloMapping)) {
            if (normalized.includes(key) || key.includes(normalized)) {
                return value;
            }
        }

        // Búsqueda por similitud de palabras
        for (let realName of Object.keys(this.sesionesPorModulo)) {
            const realNormalized = this.normalizarNombreModulo(realName);
            if (normalized.includes(realNormalized) || realNormalized.includes(normalized)) {
                return realName;
            }
        }

        return null;
    }

    /**
     * Registra un callback para cuando cambie el ciclo
     * @param {Function} callback - Función a ejecutar al cambiar el ciclo
     */
    onCicloChange(callback) {
        this.onCicloChangeCallbacks.push(callback);
    }

    /**
     * Carga los módulos del ciclo seleccionado (privado)
     * @private
     */
    _cargarModulosDelCiclo(ciclo) {
        this.modulosData = {};
        this.sesionesPorModulo = {};
        this.umbralesPorModulo = {};
        this.moduloMapping = {};

        ciclo.modulos.forEach(modulo => {
            const sesionesTotales = this.calcularSesiones(modulo.horas);
            const umbral6 = this.calcularUmbral(sesionesTotales, 6);
            const umbral4 = this.calcularUmbral(sesionesTotales, 4);

            this.modulosData[modulo.nome] = {
                curso: modulo.curso,
                codigo: modulo.codigo,
                nome: modulo.nome,
                horas: modulo.horas,
                periodos: modulo.periodosSemanais,
                sesionesTotales: sesionesTotales.toFixed(1),
                sesionesNumero: sesionesTotales,
                umbral6: umbral6,
                umbral4: umbral4
            };

            this.sesionesPorModulo[modulo.nome] = sesionesTotales;
            this.umbralesPorModulo[modulo.nome] = { umbral6, umbral4 };

            // Crear mapping para búsquedas
            const nomeNormalized = this.normalizarNombreModulo(modulo.nome);
            this.moduloMapping[nomeNormalized] = modulo.nome;

            // Mapping sin paréntesis
            const sinParentesis = modulo.nome.replace(/[\(\)]/g, '').trim();
            this.moduloMapping[this.normalizarNombreModulo(sinParentesis)] = modulo.nome;

            // Mapping por palabras significativas
            const palabras = nomeNormalized.split(' ').filter(p => p.length > 3);
            palabras.forEach(palabra => {
                this.moduloMapping[palabra] = modulo.nome;
            });
        });
    }

    /**
     * Obtiene los módulos ordenados para mostrar en tabla
     * @returns {Array} - Array de módulos ordenados
     */
    getModulosOrdenados() {
        return Object.keys(this.modulosData).sort();
    }

    /**
     * Genera HTML para la tabla de módulos
     * @returns {string} - HTML de la tabla
     */
    generarTablaModulos() {
        let html = '';
        const modulosOrdenados = this.getModulosOrdenados();

        modulosOrdenados.forEach(nome => {
            const m = this.modulosData[nome];
            html += `<tr>
                <td><strong>${m.nome}</strong></td>
                <td style="text-align: center;">${m.horas}</td>
                <td style="text-align: center;">${m.sesionesTotales}</td>
                <td style="text-align: center; font-weight: bold; color: #dc3545;">${m.umbral6}</td>
                <td style="text-align: center; font-weight: bold; color: #fd7e14;">${m.umbral4}</td>
            </tr>`;
        });

        return html;
    }

    /**
     * Valida si un módulo existe en el ciclo actual
     * @param {string} moduloName - Nombre del módulo a validar
     * @returns {boolean} - true si el módulo existe
     */
    existeModulo(moduloName) {
        return !!this.modulosData[moduloName];
    }

    /**
     * Obtiene información de un módulo específico
     * @param {string} moduloName - Nombre del módulo
     * @returns {Object|null} - Datos del módulo o null
     */
    getModuloInfo(moduloName) {
        return this.modulosData[moduloName] || null;
    }

    /**
     * Obtiene estadísticas de los módulos
     * @returns {Object} - Estadísticas de módulos
     */
    getEstadisticas() {
        const modulosArray = Object.values(this.modulosData);
        return {
            totalModulos: modulosArray.length,
            totalHoras: modulosArray.reduce((sum, m) => sum + m.horas, 0),
            horasPrimerCurso: modulosArray.filter(m => m.curso === "1º").reduce((sum, m) => sum + m.horas, 0),
            horasSegundoCurso: modulosArray.filter(m => m.curso === "2º").reduce((sum, m) => sum + m.horas, 0)
        };
    }
}

// Exportar para uso en el navegador
if (typeof window !== 'undefined') {
    window.ModulosManager = ModulosManager;
}

// Exportar para uso con módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModulosManager;
}