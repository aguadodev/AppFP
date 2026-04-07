// FaltasParser.js - Versión mejorada con extracción de centro y ciclo
class FaltasParser {
    constructor() {
        this.reset();
    }

    reset() {
        this.faltasData = [];
        this.alumnos = new Set();
        this.alumnosDetalle = {};
        this.modulos = new Set();
        this.lines = [];
        
        // Metadatos del documento
        this.metadata = {
            centro: null,
            ciclo: null,
            fechaGeneracion: null,
            totalPaginas: null
        };
    }

    /**
     * Parsea el texto de faltas y devuelve una estructura de datos
     * @param {string} inputText - Texto plano con el contenido del archivo de faltas
     * @returns {Object} - Estructura con los datos parseados
     */
    parse(inputText) {
        this.reset();
        
        if (!inputText || !inputText.trim()) {
            throw new Error('El texto de entrada está vacío');
        }

        this.lines = inputText.split('\n');
        
        // Extraer metadatos primero
        this._extractMetadata();
        
        let currentStudent = '';
        let currentStudentFull = '';
        let dentroDeDatos = false;

        for (let i = 0; i < this.lines.length; i++) {
            let line = this.lines[i].trimRight();

            if (line === '') continue;

            // Detectar el inicio de los datos de faltas
            if (line.includes('Apelidos e nome')) {
                dentroDeDatos = true;
                continue;
            }

            // Si aún no estamos en la zona de datos, saltar
            if (!dentroDeDatos) {
                continue;
            }

            // Detectar fin de los datos (línea de página o separador)
            if (line.match(/Páxina \d+/) || line.match(/^\s*$/)) {
                continue;
            }

            const studentMatch = line.match(/^(.+?, [^,]+?)(?=\s+\d{2}\/\d{2}\/\d{4})/);

            if (studentMatch) {
                currentStudentFull = studentMatch[1].trim();
                this._addStudent(currentStudentFull);
                
                const faltaPart = line.substring(studentMatch[0].length).trim();
                if (faltaPart) {
                    i = this._processFaltaLine(currentStudentFull, faltaPart, i);
                }
            }
            else if (currentStudentFull && line.match(/\d{2}\/\d{2}\/\d{4}/)) {
                i = this._processFaltaLine(currentStudentFull, line, i);
            }
        }

        if (this.faltasData.length === 0) {
            throw new Error('No se pudieron extraer datos. Verifica que el formato sea correcto.');
        }

        return this._getResult();
    }

    /**
     * Extrae metadatos del documento (centro, ciclo, fecha)
     * @private
     */
    _extractMetadata() {
        let dentroDeCabecera = true;
        let encontradoGraos = false;
        
        for (let i = 0; i < this.lines.length && dentroDeCabecera; i++) {
            const line = this.lines[i].trim();
            
            // Buscar el nombre del centro (primera línea no vacía)
            if (!this.metadata.centro && line.length > 0 && !line.match(/^\d/)) {
                // Evitar capturar líneas que no son el centro
                if (!line.includes('Graos') && !line.includes('Apelidos') && 
                    !line.includes('Data') && line.length < 100) {
                    this.metadata.centro = line;
                }
            }
            
            // Buscar "Graos D: Ciclos formativos"
            if (line.includes('Graos D:') && line.includes('Ciclos formativos')) {
                encontradoGraos = true;
                // La siguiente línea contiene el ciclo
                if (i + 1 < this.lines.length) {
                    const cicloLine = this.lines[i + 1].trim();
                    if (cicloLine && !cicloLine.includes('Dende:')) {
                        this.metadata.ciclo = cicloLine;
                    }
                }
            }
            
            // Buscar fecha del informe (formato: "Data DD/MM/YYYY HH:MM")
            const fechaMatch = line.match(/Data (\d{2}\/\d{2}\/\d{4})/);
            if (fechaMatch) {
                this.metadata.fechaGeneracion = this._parseDate(fechaMatch[1]);
            }
            
            // Buscar número de página
            const paginaMatch = line.match(/Páxina (\d+)/);
            if (paginaMatch) {
                const pagina = parseInt(paginaMatch[1]);
                if (!this.metadata.totalPaginas || pagina > this.metadata.totalPaginas) {
                    this.metadata.totalPaginas = pagina;
                }
            }
            
            // Terminar cuando encontramos "Apelidos e nome"
            if (line.includes('Apelidos e nome')) {
                dentroDeCabecera = false;
            }
        }
        
        // Limpiar el centro si tiene formato HTML o caracteres extraños
        if (this.metadata.centro) {
            this.metadata.centro = this.metadata.centro
                .replace(/<[^>]*>/g, '')
                .trim();
        }
    }

    /**
     * Verifica si una línea es cabecera o metadato
     * @private
     */
    _isHeaderLine(line) {
        const headerPatterns = [
            'Centro Educativo', 'CdCentro', 'Dirección Centro', 'Teléfono', 'email', 'web',
            'Lista detallada', 'Graos D:', '1º Desenvolvemento', 'Dende:', 'Apelidos e nome',
            'Páxina'
        ];
        
        return headerPatterns.some(pattern => line.includes(pattern)) ||
               line.match(/^Data \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
    }

    /**
     * Añade un estudiante a las estructuras de datos
     * @private
     */
    _addStudent(fullName) {
        const nameParts = fullName.split(',');
        if (nameParts.length === 2) {
            const apellidos = nameParts[0].trim();
            const nombre = nameParts[1].trim();

            this.alumnosDetalle[fullName] = {
                apellidos,
                nombre,
                fullName
            };
        } else {
            // Fallback si no hay coma
            this.alumnosDetalle[fullName] = {
                apellidos: fullName,
                nombre: '',
                fullName
            };
        }

        this.alumnos.add(fullName);
    }

    /**
     * Procesa una línea que contiene información de falta
     * @private
     */
    _processFaltaLine(student, line, currentIndex) {
        // Extraer fecha
        const fechaMatch = line.match(/(\d{2}\/\d{2}\/\d{4})/);
        if (!fechaMatch) return currentIndex;

        const fecha = fechaMatch[1];
        const fechaObj = this._parseDate(fecha);

        // Extraer tipo de falta (Asistencia o Puntualidade)
        const tipoMatch = line.match(/(Asistencia|Puntualidade)/);
        if (!tipoMatch) return currentIndex;

        const tipoFalta = tipoMatch[1];

        // Buscar el paréntesis de apertura
        const openParenIndex = line.indexOf('(');
        if (openParenIndex === -1) return currentIndex;

        // Extraer contenido del paréntesis (puede ocupar múltiples líneas)
        const { parenContent, newIndex } = this._extractParenContent(line, currentIndex, openParenIndex);
        
        // Determinar si la falta está justificada
        const justificada = this._determineJustificada(line, currentIndex, newIndex);
        
        // Procesar el contenido del paréntesis para obtener hora y módulo
        if (parenContent) {
            this._extractAndAddFalta(student, fecha, fechaObj, tipoFalta, parenContent, justificada);
        }

        return newIndex;
    }

    /**
     * Extrae el contenido dentro del paréntesis (puede estar en múltiples líneas)
     * @private
     */
    _extractParenContent(line, currentIndex, openParenIndex) {
        let parenContent = '';
        let parenLevel = 1;
        let i = openParenIndex + 1;
        let lineIndex = currentIndex;
        let currentLine = line;

        while (parenLevel > 0 && lineIndex < this.lines.length) {
            while (i < currentLine.length) {
                const char = currentLine[i];
                if (char === '(') parenLevel++;
                if (char === ')') {
                    parenLevel--;
                    if (parenLevel === 0) {
                        i++;
                        break;
                    }
                }
                if (parenLevel > 0 || char !== ')') {
                    parenContent += char;
                }
                i++;
            }

            if (parenLevel > 0) {
                lineIndex++;
                if (lineIndex < this.lines.length) {
                    currentLine = this.lines[lineIndex].trimRight();
                    i = 0;
                    if (parenContent.length > 0 && !parenContent.endsWith(' ')) {
                        parenContent += ' ';
                    }
                } else {
                    break;
                }
            }
        }

        return { parenContent, newIndex: lineIndex };
    }

    /**
     * Determina si una falta está justificada
     * @private
     */
    _determineJustificada(line, currentIndex, nextLineIndex) {
        // Obtener el resto de la línea después del paréntesis
        const closeParenIndex = line.indexOf(')', currentIndex);
        let restoLinea = '';
        
        if (closeParenIndex !== -1 && closeParenIndex + 1 < line.length) {
            restoLinea = line.substring(closeParenIndex + 1).trim();
        }

        // Buscar Si/Non en el resto de la línea
        if (restoLinea.includes('Si')) {
            return true;
        } else if (restoLinea.includes('Non')) {
            return false;
        }

        // Buscar en la siguiente línea (hasta 2 líneas siguientes)
        for (let offset = 1; offset <= 2; offset++) {
            const nextLineIndexCheck = nextLineIndex + offset;
            if (nextLineIndexCheck < this.lines.length) {
                const nextLine = this.lines[nextLineIndexCheck].trim();
                if (nextLine.includes('Si')) {
                    return true;
                } else if (nextLine.includes('Non')) {
                    return false;
                }
            }
        }

        return false;
    }

    /**
     * Extrae hora y módulo del contenido del paréntesis y añade la falta
     * @private
     */
    _extractAndAddFalta(student, fecha, fechaObj, tipoFalta, parenContent, justificada) {
        // Limpiar el contenido del paréntesis
        let cleanContent = parenContent.trim();
        
        // Eliminar "SI" o "NON" si están al final
        cleanContent = cleanContent.replace(/\s+(SI|NON)$/i, '');
        
        const parts = cleanContent.split(',');
        if (parts.length >= 2) {
            let hora = parts[0].trim();
            let modulo = parts.slice(1).join(',').trim();
            modulo = modulo.replace(/\s+/g, ' ').trim();
            
            // Limpiar módulo de posibles caracteres extraños
            modulo = modulo.replace(/[()]/g, '').trim();

            // Solo guardar si es ASISTENCIA y NO JUSTIFICADA
            if (tipoFalta === 'Asistencia' && !justificada) {
                const falta = {
                    alumno: student,
                    fecha: fecha,
                    fechaObj: fechaObj,
                    fechaSort: fechaObj ? fechaObj.toISOString().split('T')[0] : '',
                    hora: hora,
                    modulo: modulo
                };
                
                this.faltasData.push(falta);
                
                if (modulo) {
                    this.modulos.add(modulo);
                }
            }
        }
    }

    /**
     * Parsea una fecha en formato DD/MM/YYYY
     * @private
     */
    _parseDate(dateStr) {
        if (!dateStr) return null;
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            return new Date(year, month, day);
        }
        return null;
    }

    /**
     * Formatea una fecha para mostrar
     * @private
     */
    _formatDate(date) {
        if (!date) return null;
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    /**
     * Devuelve el resultado del parseo
     * @private
     */
    _getResult() {
        const self = this;
        
        return {
            // Metadatos del documento
            metadata: {
                centro: this.metadata.centro,
                ciclo: this.metadata.ciclo,
                fechaGeneracion: this.metadata.fechaGeneracion,
                fechaGeneracionStr: this.metadata.fechaGeneracion ? 
                    this._formatDate(this.metadata.fechaGeneracion) : null,
                totalPaginas: this.metadata.totalPaginas
            },
            
            // Datos principales
            faltasData: this.faltasData,
            alumnos: Array.from(this.alumnos),
            alumnosDetalle: this.alumnosDetalle,
            modulos: Array.from(this.modulos),
            
            // Métodos auxiliares
            getFaltasPorAlumno: (alumno) => {
                return self.faltasData.filter(f => f.alumno === alumno);
            },
            
            getFaltasPorModulo: (modulo) => {
                return self.faltasData.filter(f => f.modulo === modulo);
            },
            
            getFaltasPorAlumnoYModulo: (alumno, modulo) => {
                return self.faltasData.filter(f => f.alumno === alumno && f.modulo === modulo);
            },
            
            getFaltasEnRango: (fechaInicio, fechaFin) => {
                return self.faltasData.filter(f => {
                    if (!f.fechaObj) return false;
                    return f.fechaObj >= fechaInicio && f.fechaObj <= fechaFin;
                });
            },
            
            getTotalFaltas: () => self.faltasData.length,
            getTotalAlumnos: () => self.alumnos.size,
            getTotalModulos: () => self.modulos.size,
            
            // Matriz resumen
            buildResumenMatriz: (modulosList = null) => {
                const modulosArray = modulosList || Array.from(self.modulos).sort();
                const matrizResumen = {};
                
                self.alumnos.forEach(alumno => {
                    matrizResumen[alumno] = {};
                    modulosArray.forEach(m => matrizResumen[alumno][m] = 0);
                });
                
                self.faltasData.forEach(falta => {
                    if (matrizResumen[falta.alumno] && falta.modulo) {
                        matrizResumen[falta.alumno][falta.modulo]++;
                    }
                });
                
                return matrizResumen;
            },
            
            // Exportar a JSON
            toJSON: () => {
                return {
                    metadata: {
                        centro: self.metadata.centro,
                        ciclo: self.metadata.ciclo,
                        fechaGeneracion: self.metadata.fechaGeneracionStr,
                        totalPaginas: self.metadata.totalPaginas
                    },
                    faltasData: self.faltasData.map(f => ({
                        alumno: f.alumno,
                        fecha: f.fecha,
                        hora: f.hora,
                        modulo: f.modulo
                    })),
                    stats: {
                        totalFaltas: self.faltasData.length,
                        totalAlumnos: self.alumnos.size,
                        totalModulos: self.modulos.size
                    }
                };
            },
            
            // Estadísticas
            stats: {
                totalFaltas: this.faltasData.length,
                totalAlumnos: this.alumnos.size,
                totalModulos: this.modulos.size
            }
        };
    }
}

// Exportar para uso en el navegador
if (typeof window !== 'undefined') {
    window.FaltasParser = FaltasParser;
}

// Exportar para uso con módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaltasParser;
}