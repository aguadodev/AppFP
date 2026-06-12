// Generador de documentos ODT (Versión completamente funcional)
class ODTGenerator {
    constructor() {
        this.content = [];
        this.paragraphStyles = new Map();
        this.textStyles = new Map();
    }

    // Añadir texto con formato usando estilos de párrafo
    addText(text, styles = {}) {
        const styleName = this.getOrCreateParagraphStyle(styles);
        this.content.push(`<text:p text:style-name="${styleName}">${this.escapeXml(text)}</text:p>`);
    }

    // Añadir texto con formato inline (span)
    addFormattedText(text, styles = {}) {
        const spanStyle = this.getOrCreateTextStyle(styles);
        const span = `<text:span text:style-name="${spanStyle}">${this.escapeXml(text)}</text:span>`;
        this.content.push(`<text:p>${span}</text:p>`);
    }

    // Añadir texto con múltiples formatos en el mismo párrafo
    addRichText(parts) {
        let html = '<text:p>';
        for (const part of parts) {
            if (part.styles && Object.keys(part.styles).length > 0) {
                const styleName = this.getOrCreateTextStyle(part.styles);
                html += `<text:span text:style-name="${styleName}">${this.escapeXml(part.text)}</text:span>`;
            } else {
                html += this.escapeXml(part.text);
            }
        }
        html += '</text:p>';
        this.content.push(html);
    }

    // Añadir título
    addHeading(text, level = 1) {
        this.content.push(`<text:h text:style-name="Heading${level}" text:outline-level="${level}">${this.escapeXml(text)}</text:h>`);
    }

    // Añadir lista desordenada
    addUnorderedList(items) {
        let listHtml = '<text:list>';
        items.forEach(item => {
            listHtml += `<text:list-item><text:p>${this.escapeXml(item)}</text:p></text:list-item>`;
        });
        listHtml += '</text:list>';
        this.content.push(listHtml);
    }

    // Añadir lista ordenada
    addOrderedList(items) {
        let listHtml = '<text:list xml:id="list1" text:style-name="Numbering_20_1">';
        items.forEach((item, index) => {
            listHtml += `<text:list-item><text:p>${this.escapeXml(item)}</text:p></text:list-item>`;
        });
        listHtml += '</text:list>';
        this.content.push(listHtml);
    }

    // Añadir tabla
    addTable(data, headers = []) {
        let tableHtml = '<table:table table:name="Tabla1" table:style-name="Table1">';
        
        if (headers.length > 0) {
            tableHtml += '<table:table-header-rows>';
            tableHtml += '<table:table-row>';
            headers.forEach(header => {
                tableHtml += `<table:table-cell office:value-type="string">
                                <text:p text:style-name="TableHeader">${this.escapeXml(header)}</text:p>
                             </table:table-cell>`;
            });
            tableHtml += '</table:table-row>';
            tableHtml += '</table:table-header-rows>';
        }
        
        data.forEach((row, rowIndex) => {
            tableHtml += '<table:table-row>';
            row.forEach(cell => {
                const styleName = rowIndex % 2 === 0 ? 'TableCell' : 'TableCellAlt';
                tableHtml += `<table:table-cell office:value-type="string">
                                <text:p text:style-name="${styleName}">${this.escapeXml(cell)}</text:p>
                             </table:table-cell>`;
            });
            tableHtml += '</table:table-row>';
        });
        
        tableHtml += '</table:table>';
        this.content.push(tableHtml);
    }

    // Añadir salto de página
    addPageBreak() {
        this.content.push('<text:p text:style-name="PageBreak"/>');
    }

    // Crear estilo de párrafo
    getOrCreateParagraphStyle(styles) {
        const key = JSON.stringify(styles);
        if (!this.paragraphStyles.has(key)) {
            const styleName = `P${this.paragraphStyles.size + 1}`;
            this.paragraphStyles.set(key, { name: styleName, styles });
        }
        return this.paragraphStyles.get(key).name;
    }

    // Crear estilo de texto (span)
    getOrCreateTextStyle(styles) {
        const key = JSON.stringify(styles);
        if (!this.textStyles.has(key)) {
            const styleName = `T${this.textStyles.size + 1}`;
            this.textStyles.set(key, { name: styleName, styles });
        }
        return this.textStyles.get(key).name;
    }

    // Generar estilos automáticos completos
    generateAutomaticStyles() {
        let stylesXML = '';
        
        // Estilos de párrafo
        for (const [_, styleData] of this.paragraphStyles) {
            const props = this.buildParagraphProperties(styleData.styles);
            if (props) {
                stylesXML += `
        <style:style style:name="${styleData.name}" style:family="paragraph" style:parent-style-name="Standard">
            ${props}
        </style:style>`;
            }
        }
        
        // Estilos de texto (span)
        for (const [_, styleData] of this.textStyles) {
            const props = this.buildTextProperties(styleData.styles);
            if (props) {
                stylesXML += `
        <style:style style:name="${styleData.name}" style:family="text">
            ${props}
        </style:style>`;
            }
        }
        
        // Estilos para tablas
        stylesXML += `
        <style:style style:name="Table1" style:family="table">
            <style:table-properties table:align="margins" style:width="100%"/>
        </style:style>
        <style:style style:name="TableHeader" style:family="paragraph" style:parent-style-name="Standard">
            <style:paragraph-properties fo:text-align="center" fo:background-color="#D3D3D3"/>
            <style:text-properties fo:font-weight="bold" fo:font-size="12pt"/>
        </style:style>
        <style:style style:name="TableCell" style:family="paragraph" style:parent-style-name="Standard">
            <style:paragraph-properties fo:text-align="left"/>
            <style:text-properties fo:font-size="11pt"/>
        </style:style>
        <style:style style:name="TableCellAlt" style:family="paragraph" style:parent-style-name="Standard">
            <style:paragraph-properties fo:text-align="left" fo:background-color="#F5F5F5"/>
            <style:text-properties fo:font-size="11pt"/>
        </style:style>
        <style:style style:name="PageBreak" style:family="paragraph">
            <style:paragraph-properties fo:break-before="page"/>
        </style:style>
        <style:style style:name="Numbering_20_1" style:family="text-list">
            <style:list-level-properties text:level="1">
                <style:list-level-style-number style:num-format="1" style:num-suffix="."/>
            </style:list-level-properties>
        </style:style>`;
        
        return stylesXML;
    }

    // Construir propiedades de párrafo
    buildParagraphProperties(styles) {
        let props = [];
        
        if (styles.align) {
            props.push(`fo:text-align="${styles.align}"`);
        }
        if (styles.marginTop) {
            props.push(`fo:margin-top="${styles.marginTop}"`);
        }
        
        // Propiedades de texto dentro del párrafo
        let textProps = [];
        if (styles.bold) textProps.push('fo:font-weight="bold"');
        if (styles.italic) textProps.push('fo:font-style="italic"');
        if (styles.underline) textProps.push('style:text-underline-style="solid"', 'style:text-underline-width="auto"', 'style:text-underline-color="font-color"');
        if (styles.color) textProps.push(`fo:color="${styles.color}"`);
        if (styles.fontSize) textProps.push(`fo:font-size="${styles.fontSize}"`);
        if (styles.backgroundColor) textProps.push(`fo:background-color="${styles.backgroundColor}"`);
        
        let result = '';
        if (props.length > 0) {
            result += `<style:paragraph-properties ${props.join(' ')}/>`;
        }
        if (textProps.length > 0) {
            result += `<style:text-properties ${textProps.join(' ')}/>`;
        }
        
        return result;
    }

    // Construir propiedades de texto
    buildTextProperties(styles) {
        let props = [];
        
        if (styles.bold) props.push('fo:font-weight="bold"');
        if (styles.italic) props.push('fo:font-style="italic"');
        if (styles.underline) props.push('style:text-underline-style="solid"', 'style:text-underline-width="auto"', 'style:text-underline-color="font-color"');
        if (styles.color) props.push(`fo:color="${styles.color}"`);
        if (styles.fontSize) props.push(`fo:font-size="${styles.fontSize}"`);
        if (styles.backgroundColor) props.push(`fo:background-color="${styles.backgroundColor}"`);
        
        if (props.length === 0) return '';
        
        return `<style:text-properties ${props.join(' ')}/>`;
    }

    // Escapar XML
    escapeXml(text) {
        if (!text) return '';
        return text.replace(/[<>&]/g, (match) => {
            switch(match) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                default: return match;
            }
        });
    }

    // Limpiar contenido
    clear() {
        this.content = [];
        this.paragraphStyles.clear();
        this.textStyles.clear();
    }

    // Generar styles.xml
    getStylesXML() {
        const automaticStyles = this.generateAutomaticStyles();
        
        return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" 
                        xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" 
                        xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" 
                        xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" 
                        xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" 
                        xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" 
                        xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" 
                        office:version="1.2">
    <office:styles>
        <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
        
        <style:style style:name="Heading1" style:family="paragraph" style:parent-style-name="Standard">
            <style:paragraph-properties fo:margin-top="0.4cm" fo:margin-bottom="0.2cm" fo:keep-with-next="always"/>
            <style:text-properties fo:font-size="24pt" fo:font-weight="bold" fo:color="#000000" style:font-name="Arial"/>
        </style:style>
        
        <style:style style:name="Heading2" style:family="paragraph" style:parent-style-name="Standard">
            <style:paragraph-properties fo:margin-top="0.3cm" fo:margin-bottom="0.1cm"/>
            <style:text-properties fo:font-size="18pt" fo:font-weight="bold" fo:color="#333333" style:font-name="Arial"/>
        </style:style>
    </office:styles>
    
    <office:automatic-styles>
        <style:page-layout style:name="Mpm1">
            <style:page-layout-properties fo:margin-top="2cm" fo:margin-bottom="2cm" 
                                          fo:margin-left="2cm" fo:margin-right="2cm"/>
        </style:page-layout>
        ${automaticStyles}
    </office:automatic-styles>
    
    <office:master-styles>
        <style:master-page style:name="Standard" style:page-layout-name="Mpm1"/>
    </office:master-styles>
</office:document-styles>`;
    }

    // Generar content.xml
    getContentXML() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" 
                         xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" 
                         xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" 
                         xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" 
                         xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" 
                         xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" 
                         xmlns:xlink="http://www.w3.org/1999/xlink" 
                         office:version="1.2">
    <office:body>
        <office:text>
${this.content.join('\n')}
        </office:text>
    </office:body>
</office:document-content>`;
    }

    // Generar manifest.xml
    getManifestXML() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
    <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
    <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
    <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;
    }

    // Crear archivo ZIP
    async createODTZip() {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is required. Include it in your HTML.');
        }
        
        const zip = new JSZip();
        
        zip.file('mimetype', 'application/vnd.oasis.opendocument.text', { compression: 'STORE' });
        zip.file('styles.xml', this.getStylesXML());
        zip.file('content.xml', this.getContentXML());
        zip.folder('META-INF').file('manifest.xml', this.getManifestXML());
        
        return await zip.generateAsync({ type: 'blob' });
    }

    // Descargar archivo
    async download(filename = 'documento.odt') {
        const blob = await this.createODTZip();
        
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// Ejemplo de uso
async function generarEjemploODT() {
    const generator = new ODTGenerator();
    
    // Título principal
    generator.addHeading("Ejemplo de Documento ODT", 1);
    generator.addText("Este es un documento de ejemplo generado desde JavaScript con diferentes formatos.", {});
    
    // Textos con formato usando el método addFormattedText
    generator.addHeading("Textos con formato", 2);
    generator.addFormattedText("Texto en negrita", { bold: true });
    generator.addFormattedText("Texto en cursiva", { italic: true });
    generator.addFormattedText("Texto subrayado", { underline: true });
    generator.addFormattedText("Texto en color rojo", { color: "#FF0000" });
    generator.addFormattedText("Texto con fondo amarillo", { backgroundColor: "#FFFF00" });
    generator.addFormattedText("Texto centrado", { align: "center" });
    generator.addFormattedText("Texto grande", { fontSize: "20pt" });
    
    // Texto con múltiples formatos combinados
    generator.addHeading("Formatos combinados", 2);
    generator.addFormattedText("Negrita + Cursiva + Rojo", { bold: true, italic: true, color: "#FF0000" });
    generator.addFormattedText("Negrita + Subrayado + Azul", { bold: true, underline: true, color: "#0000FF" });
    
    // Texto enriquecido (múltiples formatos en el mismo párrafo)
    generator.addHeading("Texto enriquecido", 2);
    generator.addRichText([
        { text: "Este texto tiene ", styles: {} },
        { text: "negrita", styles: { bold: true } },
        { text: ", ", styles: {} },
        { text: "cursiva", styles: { italic: true } },
        { text: " y ", styles: {} },
        { text: "colores", styles: { color: "#FF6600" } },
        { text: " en el mismo párrafo.", styles: {} }
    ]);
    
    // Listas
    generator.addHeading("Listas", 2);
    generator.addText("Lista desordenada (con viñetas):", {});
    generator.addUnorderedList([
        "Primer elemento",
        "Segundo elemento", 
        "Tercer elemento",
        "Cuarto elemento"
    ]);
    
    generator.addText("Lista ordenada (numerada):", {});
    generator.addOrderedList([
        "Elemento número 1",
        "Elemento número 2",
        "Elemento número 3",
        "Elemento número 4"
    ]);
    
    // Tabla
    generator.addHeading("Tabla de ejemplo", 2);
    generator.addTable([
        ["Manzanas", "Rojo", "3.50 €"],
        ["Peras", "Verde", "2.80 €"],
        ["Naranjas", "Naranja", "4.20 €"],
        ["Plátanos", "Amarillo", "2.90 €"]
    ], ["Producto", "Color", "Precio"]);
    
    // Salto de página
    generator.addPageBreak();
    
    // Segunda página
    generator.addHeading("Segunda página", 1);
    generator.addText("Este contenido aparece después de un salto de página.", {});
    generator.addFormattedText("Texto con formato en la segunda página", { bold: true, color: "#0066CC" });
    
    generator.addHeading("Ejemplo adicional", 2);
    generator.addUnorderedList([
        "Los saltos de página funcionan correctamente",
        "Las listas ordenadas muestran números",
        "Los colores se aplican correctamente",
        "Los formatos combinados también funcionan"
    ]);
    
    // Descargar el archivo
    await generator.download('ejemplo_odt_funcional.odt');
    console.log('Documento ODT generado correctamente');
}

// Exponer la función globalmente
if (typeof window !== 'undefined') {
    window.generarEjemploODT = generarEjemploODT;
}