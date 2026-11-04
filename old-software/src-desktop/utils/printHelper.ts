/**
 * High-reliability printing utility for thermal receipt printers (80mm, 58mm)
 * and standard office printers (A4, A5).
 * 
 * Creates an isolated hidden iframe with exact page size, zero margins,
 * crisp monochrome contrast for thermal heads, and auto-cleanup.
 */

export interface PrintOptions {
  format?: '80mm' | '58mm' | 'a5' | 'a4';
  title?: string;
  cssContent?: string;
}

export function printHtmlContent(htmlBody: string, options: PrintOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const { format = '80mm', title = 'Print', cssContent = '' } = options;

    let pageStyle = '';
    let containerWidth = '72mm';

    if (format === '80mm') {
      pageStyle = `@page { size: 80mm auto; margin: 0mm; }`;
      containerWidth = '72mm';
    } else if (format === '58mm') {
      pageStyle = `@page { size: 58mm auto; margin: 0mm; }`;
      containerWidth = '48mm';
    } else if (format === 'a5') {
      pageStyle = `@page { size: A5; margin: 8mm; }`;
      containerWidth = '130mm';
    } else if (format === 'a4') {
      pageStyle = `@page { size: A4; margin: 10mm; }`;
      containerWidth = '190mm';
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            ${pageStyle}
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #fff;
              color: #000;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
            }
            .print-wrapper {
              width: ${containerWidth};
              max-width: 100%;
              margin: 0 auto;
              padding: ${format === '80mm' || format === '58mm' ? '2mm 1mm' : '4mm'};
            }
            ${cssContent}
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${htmlBody}
          </div>
        </body>
      </html>
    `;

    // Create hidden iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.id = `print-frame-${Date.now()}`;

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      // Fallback
      window.print();
      resolve(false);
      return;
    }

    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Give browser brief tick to parse and render images/fonts
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        resolve(true);
      } catch (err) {
        console.error('Iframe print error:', err);
        window.print();
        resolve(false);
      } finally {
        // Clean up iframe after print dialog finishes
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }
    }, 250);
  });
}
