import { EmailColors } from './constants/email-colors';

export interface ContactEmailData {
  name: string;
  email: string;
  phone: string;
  message: string;
  receivedDate: string;
}

export class EmailTemplateGenerator {
  static generate(
    title: string,
    recipientName: string,
    bodyContent: string,
  ): string {
    const year = new Date().getFullYear();

    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    /* Reset & Base */
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    
    /* Mobile Styles */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; margin: 0 auto !important; }
      .content-padding { padding: 20px !important; }
      .header-padding { padding: 30px 20px 20px !important; }
      .h1-mobile { font-size: 28px !important; }
      .p-mobile { font-size: 18px !important; }
    }

    /* Dark Mode Styles */
    @media (prefers-color-scheme: dark) {
      .body-bg { background-color: #121212 !important; }
      .card-bg { background-color: #2C2C2C !important; }
      .text-primary { color: #FFFFFF !important; }
      .text-header { color: ${EmailColors.primaryText} !important; } /* Force Dark Blue on Green Header */
      .footer-bg { background-color: #1F1F1F !important; }
      .border-color { border-color: #444444 !important; }
    }
  </style>
</head>
<body class="body-bg" style="margin: 0; padding: 0; background-color: ${EmailColors.bodyBackground}; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="body-bg" style="background-color: ${EmailColors.bodyBackground}; padding: 40px 0;">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table role="presentation" align="center" style="width:600px;">
        <tr>
        <td style="padding:0;">
        <![endif]-->
        <table class="email-container card-bg" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: ${EmailColors.cardBackground}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header with Green Background -->
          <tr>
            <td class="header-padding" style="background-color: ${EmailColors.brandGreen}; padding: 40px 40px 30px; text-align: center;">
              <h1 class="h1-mobile text-header" style="color: ${EmailColors.primaryText}; margin: 0 0 10px 0; font-size: 36px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase;">Clubinhos NIB</h1>
              <p class="p-mobile text-header" style="margin: 0; color: ${EmailColors.primaryText}; font-size: 24px; font-weight: 700;">${title}</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 40px;">
              ${recipientName ? `<p class="text-primary" style="margin: 0 0 20px 0; color: ${EmailColors.primaryText}; font-size: 20px; font-weight: 700;">Olá, ${recipientName}!</p>` : ''}
              
              <div class="text-primary" style="color: ${EmailColors.primaryText}; font-size: 16px; line-height: 1.6; font-weight: 500;">
                ${bodyContent}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="footer-bg" style="background-color: ${EmailColors.primaryText}; padding: 30px 40px; text-align: center;">
              <p style="margin: 0; color: ${EmailColors.cardBackground}; font-size: 14px; font-weight: 600;">&copy; ${year} Clubinho NIB</p>
              <p style="margin: 5px 0 0; color: ${EmailColors.cardBackground}; opacity: 0.8; font-size: 12px;">Conectando Crianças através da fé</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }

  static generatePasswordRecovery(userName: string, resetLink: string): string {
    const body = `
      <p class="text-primary" style="color: ${EmailColors.primaryText};">Recebemos uma solicitação para redefinir sua senha.</p>
      <p class="text-primary" style="color: ${EmailColors.primaryText};">Clique no botão abaixo para criar uma nova senha:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: ${EmailColors.accent}; color: ${EmailColors.cardBackground}; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: 800; display: inline-block; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Redefinir Senha</a>
      </div>
      <p class="text-primary" style="font-size: 14px; color: ${EmailColors.primaryText}; margin-top: 30px;">Ou copie e cole o link abaixo no seu navegador:</p>
      <p class="text-primary" style="font-size: 12px; color: ${EmailColors.accent}; word-break: break-all; font-weight: 600;">${resetLink}</p>
      <p class="text-primary" style="margin-top: 20px; font-size: 13px; font-style: italic; color: ${EmailColors.primaryText};">Este link é válido por 30 minutos.</p>
    `;
    return this.generate('Recuperação de Senha', userName, body);
  }

  static generatePasswordChanged(userName: string, loginLink: string): string {
    const body = `
      <p class="text-primary" style="color: ${EmailColors.primaryText};">Sua senha foi alterada com sucesso!</p>
      <p class="text-primary" style="color: ${EmailColors.primaryText};">Agora você pode acessar sua conta com a nova senha.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${loginLink}" style="background-color: ${EmailColors.accent}; color: ${EmailColors.cardBackground}; padding: 16px 32px; text-decoration: none; border-radius: 50px; font-weight: 800; display: inline-block; text-transform: uppercase; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">Acessar Plataforma</a>
      </div>
    `;
    return this.generate('Sucesso na alteração de senha', userName, body);
  }

  static generateContactNotification(data: ContactEmailData): string {
    const body = `
      <h2 class="text-primary" style="color: ${EmailColors.accent}; font-size: 20px; font-weight: 800; margin-bottom: 20px; text-transform: uppercase;">Detalhes do Contato</h2>
      
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 25px; border-collapse: separate; border-spacing: 0;">
        <tr>
          <td class="border-color" style="padding: 12px; border: 2px solid ${EmailColors.brandGreen}; border-radius: 8px; margin-bottom: 10px; display: block;">
            <strong class="text-primary" style="color: ${EmailColors.accent}; display: block; font-size: 12px; text-transform: uppercase;">Nome</strong>
            <span class="text-primary" style="color: ${EmailColors.primaryText}; font-size: 16px; font-weight: 600;">${data.name}</span>
          </td>
        </tr>
         <tr>
          <td class="border-color" style="padding: 12px; border: 2px solid ${EmailColors.brandGreen}; border-radius: 8px; margin-bottom: 10px; display: block;">
            <strong class="text-primary" style="color: ${EmailColors.accent}; display: block; font-size: 12px; text-transform: uppercase;">E-mail</strong>
            <a href="mailto:${data.email}" class="text-primary" style="color: ${EmailColors.primaryText}; font-size: 16px; font-weight: 600; text-decoration: none;">${data.email}</a>
          </td>
        </tr>
         <tr>
          <td class="border-color" style="padding: 12px; border: 2px solid ${EmailColors.brandGreen}; border-radius: 8px; margin-bottom: 10px; display: block;">
            <strong class="text-primary" style="color: ${EmailColors.accent}; display: block; font-size: 12px; text-transform: uppercase;">Telefone</strong>
             <a href="tel:${data.phone.replace(/\D/g, '')}" class="text-primary" style="color: ${EmailColors.primaryText}; font-size: 16px; font-weight: 600; text-decoration: none;">${data.phone}</a>
          </td>
        </tr>
         <tr>
          <td class="border-color" style="padding: 12px; border: 2px solid ${EmailColors.brandGreen}; border-radius: 8px; margin-bottom: 10px; display: block;">
            <strong class="text-primary" style="color: ${EmailColors.accent}; display: block; font-size: 12px; text-transform: uppercase;">Data</strong>
            <span class="text-primary" style="color: ${EmailColors.primaryText}; font-size: 16px; font-weight: 600;">${data.receivedDate}</span>
          </td>
        </tr>
      </table>

      <h2 class="text-primary" style="color: ${EmailColors.accent}; font-size: 20px; font-weight: 800; margin-bottom: 15px; text-transform: uppercase;">Mensagem</h2>
      <div class="border-color" style="background-color: transparent; border: 2px solid ${EmailColors.brandGreen}; padding: 20px; border-radius: 12px;">
        <p class="text-primary" style="margin: 0; color: ${EmailColors.primaryText}; white-space: pre-line; font-weight: 600;">${data.message}</p>
      </div>
    `;

    return this.generate('Novo Contato', '', body);
  }
}
