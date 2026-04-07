// FaltasParser.js
// Módulo independiente para parsear el archivo de faltas desde texto plano

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
        
        let currentStudent = '';
        let currentStudentFull = '';

        for (let i = 0; i < this.lines.length; i++) {
            let line = this.lines[i].trimRight();

            if (line === '') continue;

            // Saltar líneas de cabecera/metadatos
            if (this._isHeaderLine(line)) {
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

        // Buscar en la siguiente línea
        const nextLineIndexCheck = nextLineIndex + 1;
        if (nextLineIndexCheck < this.lines.length) {
            const nextLine = this.lines[nextLineIndexCheck].trim();
            if (nextLine.includes('Si')) {
                return true;
            } else if (nextLine.includes('Non')) {
                return false;
            }
        }

        return false;
    }

    /**
     * Extrae hora y módulo del contenido del paréntesis y añade la falta
     * @private
     */
    _extractAndAddFalta(student, fecha, fechaObj, tipoFalta, parenContent, justificada) {
        const parts = parenContent.split(',');
        if (parts.length >= 2) {
            let hora = parts[0].trim();
            let modulo = parts.slice(1).join(',').trim();
            modulo = modulo.replace(/\s+/g, ' ').trim();

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
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]);
        }
        return null;
    }

    /**
     * Devuelve el resultado del parseo
     * @private
     */
    _getResult() {
        return {
            // Datos principales
            faltasData: this.faltasData,
            alumnos: Array.from(this.alumnos),
            alumnosDetalle: this.alumnosDetalle,
            modulos: Array.from(this.modulos),
            
            // Métodos auxiliares
            getFaltasPorAlumno: (alumno) => {
                return this.faltasData.filter(f => f.alumno === alumno);
            },
            
            getFaltasPorModulo: (modulo) => {
                return this.faltasData.filter(f => f.modulo === modulo);
            },
            
            getFaltasPorAlumnoYModulo: (alumno, modulo) => {
                return this.faltasData.filter(f => f.alumno === alumno && f.modulo === modulo);
            },
            
            getTotalFaltas: () => this.faltasData.length,
            getTotalAlumnos: () => this.alumnos.size,
            getTotalModulos: () => this.modulos.size,
            
            // Matriz resumen
            buildResumenMatriz: (modulosList = null) => {
                const modulosArray = modulosList || Array.from(this.modulos).sort();
                const matrizResumen = {};
                
                this.alumnos.forEach(alumno => {
                    matrizResumen[alumno] = {};
                    modulosArray.forEach(m => matrizResumen[alumno][m] = 0);
                });
                
                this.faltasData.forEach(falta => {
                    if (matrizResumen[falta.alumno] && falta.modulo) {
                        matrizResumen[falta.alumno][falta.modulo]++;
                    }
                });
                
                return matrizResumen;
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

// Exportar para uso en el navegador (global)
if (typeof window !== 'undefined') {
    window.FaltasParser = FaltasParser;
}

// Exportar para uso con módulos ES6 (si es necesario)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FaltasParser;
}