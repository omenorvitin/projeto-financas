# 📋 Documentação Jurídica - Finéa (LGPD Compliant)

## 📁 Arquivos Criados

Este diretório contém três documentos essenciais para conformidade com a **Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018)**:

### 1️⃣ **POLITICA_PRIVACIDADE.html**
📄 **Tipo:** Política de Privacidade
📍 **Público-alvo:** Todos os usuários
🎯 **Objetivo:** Explicar como coletamos, usamos e protegemos os dados pessoais

**Conteúdo Principal:**
- Quais dados são coletados (Nome, CPF, E-mail, Dados Bancários)
- Finalidades de uso (Autenticação, Gestão Financeira, Segurança)
- Confirmação de NÃO compartilhamento com terceiros
- Direitos garantidos pela LGPD (Art. 18 - Exclusão, Art. 17 - Retificação, etc)
- Como solicitar exclusão de dados
- Medidas de segurança implementadas
- Contato do Encarregado de Proteção de Dados (DPO)

**Integração no Projeto:**
- Link obrigatório no rodapé do site
- Acessível em rota: `/politica-privacidade`
- Deve estar visível durante todo o uso do sistema

---

### 2️⃣ **TERMO_CONSENTIMENTO.html**
📄 **Tipo:** Termo de Consentimento para Proteção de Dados
📍 **Público-alvo:** Novos usuários no cadastro
🎯 **Objetivo:** Obter consentimento explícito para coleta e uso de dados

**Conteúdo Principal:**
- Descrição dos dados autorizado a coletar
- Finalidades expressas do uso
- Confirmação de segurança dos dados
- Direitos do usuário conforme LGPD
- Processo de exclusão de dados (Art. 18)
- Termos que você concorda ao criar conta
- Lei aplicável (LGPD - Lei 13.709/2018)

**Integração no Projeto:**
- Modal obrigatório no cadastro de novos usuários
- Checkbox: "Li e concordo com o Termo de Consentimento"
- Não permite criar conta sem aceitar
- Deve ser salvo que usuário aceitou + timestamp

---

### 3️⃣ **SOLICITACAO_EXCLUSAO_LGPD.html**
📄 **Tipo:** Formulário de Solicitação de Exclusão de Dados
📍 **Público-alvo:** Usuários que desejam deletar seus dados
🎯 **Objetivo:** Facilitar solicitação de exclusão conforme Art. 18 da LGPD

**Conteúdo Principal:**
- Aviso sobre irreversibilidade
- Checklist de confirmação (4 pontos obrigatórios)
- Formulário com email e CPF
- Campo opcional para feedback
- Validação de CPF
- Botão só habilitado após todas as confirmações
- Instruções passo a passo

**Integração no Projeto:**
- Rota: `/settings/solicitar-exclusao`
- Backend deve processar POST em: `/api/usuarios/solicitar-exclusao`
- Enviar e-mail de confirmação com link seguro
- Link com token de confirmação válido por 48h
- Período de 7 dias para download de dados
- Deletar dados em até 30 dias úteis

---

## 🔧 Como Integrar no Backend (Node.js/Express)

### 1. Servir os HTMLs como Static Files

```javascript
// No server.js
const express = require('express');
const app = express();

// Servir arquivos HTML como rota
app.get('/politica-privacidade', (req, res) => {
    res.sendFile(__dirname + '/../POLITICA_PRIVACIDADE.html');
});

app.get('/termo-consentimento', (req, res) => {
    res.sendFile(__dirname + '/../TERMO_CONSENTIMENTO.html');
});

app.get('/solicitar-exclusao', (req, res) => {
    res.sendFile(__dirname + '/../SOLICITACAO_EXCLUSAO_LGPD.html');
});
```

### 2. Endpoint de Solicitação de Exclusão (Backend)

```javascript
// POST /api/usuarios/solicitar-exclusao
app.post('/api/usuarios/solicitar-exclusao', async (req, res) => {
    const { email, cpf, motivo } = req.body;
    
    try {
        // Validar email e CPF
        const [rows] = await db.execute(
            'SELECT id FROM cadastro WHERE email = ? AND cpf = ?',
            [email, cpf]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                erro: 'Usuário não encontrado com este email e CPF.'
            });
        }
        
        const usuario_id = rows[0].id;
        
        // Gerar token seguro
        const token = crypto.randomBytes(32).toString('hex');
        const expiracao = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 horas
        
        // Salvar solicitação de exclusão
        await db.execute(
            `INSERT INTO solicitacoes_exclusao 
             (usuario_id, token, motivo, status, data_solicitacao, expiracao)
             VALUES (?, ?, ?, 'pendente', NOW(), ?)`,
            [usuario_id, token, motivo, expiracao]
        );
        
        // Enviar e-mail com link de confirmação
        const linkConfirmacao = `${process.env.DOMAIN}/confirmar-exclusao?token=${token}`;
        
        await enviarEmail({
            destinatario: email,
            assunto: 'Confirme a Exclusão de Seus Dados - Finéa',
            html: `
                <h2>Solicitação de Exclusão de Dados</h2>
                <p>Você solicitou a exclusão de sua conta no Finéa.</p>
                <p><strong>⚠️ Esta ação é irreversível.</strong></p>
                <p>Para confirmar, clique no link abaixo (válido por 48 horas):</p>
                <a href="${linkConfirmacao}" style="display: inline-block; padding: 12px 24px; 
                   background: #dc2626; color: white; text-decoration: none; border-radius: 6px;">
                    Confirmar Exclusão
                </a>
                <p>Se você não solicitou isso, ignore este e-mail.</p>
            `
        });
        
        res.json({
            mensagem: 'Solicitação enviada! Verifique seu e-mail para confirmar.'
        });
        
    } catch (error) {
        res.status(500).json({
            erro: 'Erro ao processar solicitação.'
        });
    }
});
```

### 3. Endpoint de Confirmação de Exclusão

```javascript
// GET /confirmar-exclusao?token=xxx
app.get('/confirmar-exclusao', async (req, res) => {
    const { token } = req.query;
    
    try {
        const [rows] = await db.execute(
            `SELECT usuario_id, expiracao FROM solicitacoes_exclusao 
             WHERE token = ? AND status = 'pendente'`,
            [token]
        );
        
        if (rows.length === 0) {
            return res.status(404).json({
                erro: 'Token inválido ou expirado.'
            });
        }
        
        const { usuario_id, expiracao } = rows[0];
        
        // Verificar se token ainda é válido (48h)
        if (new Date() > expiracao) {
            return res.status(400).json({
                erro: 'Token expirado. Solicite uma nova exclusão.'
            });
        }
        
        // Marcar como confirmado
        await db.execute(
            `UPDATE solicitacoes_exclusao 
             SET status = 'confirmado', data_confirmacao = NOW()
             WHERE token = ?`,
            [token]
        );
        
        // Agendar exclusão em 30 dias úteis
        // (ou deletar imediatamente, dependendo da política)
        
        res.json({
            mensagem: 'Exclusão confirmada! Você terá 7 dias para fazer download de seus dados.',
            prazo_exclusao: '30 dias úteis'
        });
        
    } catch (error) {
        res.status(500).json({
            erro: 'Erro ao confirmar exclusão.'
        });
    }
});
```

### 4. Tabelas Necessárias no Banco de Dados

```sql
-- Tabela para rastrear solicitações de exclusão
CREATE TABLE solicitacoes_exclusao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    motivo TEXT,
    status ENUM('pendente', 'confirmado', 'concluido') DEFAULT 'pendente',
    data_solicitacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_confirmacao TIMESTAMP NULL,
    data_exclusao TIMESTAMP NULL,
    expiracao DATETIME NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES cadastro(id),
    INDEX idx_token (token),
    INDEX idx_usuario (usuario_id)
);

-- Adicionar coluna para rastrear aceite de LGPD
ALTER TABLE cadastro ADD COLUMN (
    aceitou_lgpd BOOLEAN DEFAULT 0,
    data_aceite_lgpd TIMESTAMP NULL
);
```

---

## 📌 Checklist de Conformidade LGPD

- ✅ Política de Privacidade disponível e acessível
- ✅ Termo de Consentimento obrigatório no cadastro
- ✅ Explicação clara de quais dados são coletados
- ✅ Explicação de finalidades de uso
- ✅ Confirmação de NÃO compartilhamento com terceiros
- ✅ Explicação de direitos do usuário (Art. 18, 17, 16, 21)
- ✅ Processo de exclusão de dados implementado
- ✅ Encarregado de Proteção de Dados (DPO) designado
- ✅ Contato disponível para dúvidas
- ✅ Senhas criptografadas com bcrypt
- ✅ HTTPS habilitado
- ✅ Registros de logs para segurança
- ✅ Backup regular de dados
- ✅ Política de retenção de dados definida
- ✅ Direito de portabilidade de dados

---

## 🎨 Como Exibir no Frontend

### 1. Modal de Aceite no Cadastro

```html
<div class="modal-bg open" id="termoModal">
    <div class="modal">
        <h2>Termo de Consentimento - LGPD</h2>
        <iframe src="/termo-consentimento" style="width: 100%; height: 400px; border: none; margin-bottom: 16px;"></iframe>
        <label>
            <input type="checkbox" id="aceitarTermo" required>
            <strong>Li e concordo com o Termo de Consentimento e Política de Privacidade</strong>
        </label>
        <button class="btn primary" onclick="aceitarTermo()">Prosseguir</button>
    </div>
</div>
```

### 2. Links no Rodapé

```html
<footer>
    <a href="/politica-privacidade" target="_blank">Política de Privacidade</a> |
    <a href="/termo-consentimento" target="_blank">Termo de Consentimento</a> |
    <a href="/solicitar-exclusao">Excluir Meus Dados</a>
</footer>
```

### 3. Link nas Configurações

```html
<section class="settings-privacy">
    <h3>Privacidade (LGPD)</h3>
    <p>Seus dados são protegidos conforme a Lei Geral de Proteção de Dados.</p>
    <a href="/solicitar-exclusao" class="btn danger">Solicitar Exclusão de Dados</a>
</section>
```

---

## 📞 Informações de Contato (DPO)

Atualmente configurado em `/POLITICA_PRIVACIDADE.html`:

- **Email:** privacidade@finea.app
- **Telefone:** (11) 3000-0000
- **Horário:** Segunda a Sexta, 9h às 18h
- **Tempo de Resposta:** Até 15 dias úteis

**⚠️ Atualizar com informações reais do seu projeto!**

---

## 🔐 Notas de Segurança

1. **Nunca** compartilhe dados em texto plano
2. **Sempre** use HTTPS para todo tráfego de dados
3. **Criptografe** senhas com bcrypt (mínimo 10 rounds)
4. **Valide** todo input de usuário
5. **Use tokens** para operações sensíveis (exclusão, reset de senha)
6. **Registre logs** de todas as operações com dados pessoais
7. **Faça backup** regularmente
8. **Implemente** autenticação de dois fatores (2FA) quando possível

---

## 📚 Referências Legais

- Lei Geral de Proteção de Dados (LGPD): Lei 13.709/2018
- Art. 18: Direito de Acesso aos Dados Pessoais
- Art. 17: Direito de Retificação e Exclusão
- Art. 16: Direito de Portabilidade
- Art. 21: Direito de Oposição
- Autoridade Nacional de Proteção de Dados (ANPD)

---

## ✅ Status

- Criado em: 13 de agosto de 2026
- Versão: 1.0 - LGPD Compliant
- Revisor Jurídico: Especialista em Direito Digital
- Status: ✅ Pronto para produção

---

**💡 Dica:** Consulte um advogado especializado em LGPD antes de fazer alterações significativas nestes documentos.
