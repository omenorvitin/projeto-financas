# 📝 Guia de Integração - login.html

## 📍 Localização do Arquivo
```
projetinho maromba/
├── login.html  ← Página de Login e Cadastro
├── index.html  ← Dashboard principal
├── app.py
├── requirements.txt
├── package.json
├── BackEnd/
│   ├── server.js
│   └── db.js
└── FrontEnd/
    ├── style.css
    └── ...
```

---

## 🎯 Funcionalidades Implementadas

### ✅ Login
- Validação de e-mail e senha
- Requisição POST para `/api/usuarios/login`
- Armazenamento de dados do usuário em localStorage
- Redirecionamento para dashboard após sucesso
- Tratamento de erros com mensagens claras

### ✅ Cadastro
- Validação de nome, CPF, e-mail e senha
- Validação de CPF (apenas 11 dígitos)
- Validação de força de senha (mínimo 6 caracteres)
- Validação obrigatória de Termos de Consentimento (LGPD)
- Links para Política de Privacidade e Termo de Consentimento
- Limpeza automática de formulário após sucesso

### ✅ UX/UI Otimizações
- Design moderno com gradiente
- Transições suaves e animações
- Estado de carregamento nos botões (spinner)
- Mensagens de feedback com cores (sucesso/erro)
- Responsividade completa (mobile, tablet, desktop)
- Acessibilidade web (labels, aria-label, focus visível)
- Suporte a keyboard (Enter para submit)
- Prevents zoom no iOS (font-size 16px nos inputs)

---

## 🔧 Como Usar

### 1️⃣ Servir o Arquivo (Express)

No seu `server.js`, adicione:

```javascript
// Servir página de login como static file
app.use(express.static(__dirname + '/../'));

// Ou rota específica
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/../login.html');
});
```

### 2️⃣ Acessar a Página

```
http://localhost:3000/login
```

### 3️⃣ Fluxo de Uso

**Novo Usuário:**
1. Clica em "Cadastrar"
2. Preenche formulário (Nome, CPF, E-mail, Senha)
3. Marca checkbox de LGPD
4. Clica em "Criar Conta"
5. Recebe confirmação e volta para "Entrar"

**Usuário Existente:**
1. Clica em "Entrar"
2. Digita E-mail e Senha
3. Clica em "Entrar na Conta"
4. Redireciona para `index.html` (dashboard)

---

## 📊 Validações Implementadas

| Campo | Validações |
|-------|-----------|
| **Nome** | Obrigatório, mínimo 2 palavras |
| **CPF** | Obrigatório, 11 dígitos, sem validação de dígito (aplique no backend se desejar) |
| **E-mail** | Obrigatório, formato válido (contém @) |
| **Senha** | Obrigatório, mínimo 6 caracteres |
| **Termos** | Obrigatório, checkbox deve estar marcado |

---

## 🌐 Endpoints Esperados no Backend

### POST `/api/usuarios/login`
**Request:**
```json
{
  "email": "usuario@email.com",
  "senha": "senha123"
}
```

**Response (Sucesso - 200):**
```json
{
  "mensagem": "Login realizado com sucesso!",
  "usuario": {
    "id": 1,
    "nome": "João Silva",
    "email": "usuario@email.com"
  }
}
```

**Response (Erro - 401):**
```json
{
  "erro": "Usuário não encontrado ou inativo."
}
```

---

### POST `/api/usuarios/cadastro`
**Request:**
```json
{
  "nome": "João da Silva",
  "cpf": "12345678901",
  "email": "joao@email.com",
  "senha": "senha123",
  "aceitou_termos": true
}
```

**Response (Sucesso - 201):**
```json
{
  "mensagem": "Usuário cadastrado com sucesso!",
  "usuario_id": 1
}
```

**Response (Erro - 400):**
```json
{
  "erro": "Todos os campos (nome, cpf, email, senha) são obrigatórios."
}
```

---

## 💾 Dados Salvos em localStorage

Após login bem-sucedido, os dados do usuário são salvos:

```javascript
localStorage.setItem('usuario', JSON.stringify({
  id: 1,
  nome: "João Silva",
  email: "usuario@email.com"
}));
```

**Para acessar no index.html:**
```javascript
const usuario = JSON.parse(localStorage.getItem('usuario'));
console.log(usuario.nome); // "João Silva"
```

**Para logout:**
```javascript
localStorage.removeItem('usuario');
window.location.href = './login.html';
```

---

## 🎨 Personalizações

### Alterar Cores

No CSS, modifique as variáveis:

```css
:root {
    --accent: #38bdf8;        /* Azul claro */
    --accent-hover: #0284c7;  /* Azul escuro */
    --success: #4ade80;       /* Verde */
    --error: #f87171;         /* Vermelho */
}
```

### Alterar URL da API

No JavaScript, modifique:

```javascript
const CONFIG = {
    API_BASE: 'http://localhost:3000/api/usuarios', // ← Alterar aqui
    TIMEOUT: 5000
};
```

### Alterar Links LGPD

No HTML, atualize os hrefs:

```html
<a href="./TERMO_CONSENTIMENTO.html" target="_blank">Termos de Uso</a>
<a href="./POLITICA_PRIVACIDADE.html" target="_blank">Política de Privacidade</a>
```

---

## 🐛 Tratamento de Erros

A página trata os seguintes cenários:

| Cenário | Mensagem | Ação |
|---------|----------|------|
| Campos vazios | "Por favor, preencha todos os campos." | Destaca feedback |
| E-mail inválido | "E-mail inválido." | Destaca feedback |
| CPF inválido | "CPF inválido. Digite apenas números." | Destaca feedback |
| Senha fraca | "Senha deve ter no mínimo 6 caracteres." | Destaca feedback |
| Termos não aceitos | "Você deve aceitar os termos para continuar." | Destaca feedback |
| Timeout (5s) | "Tempo limite excedido. Tente novamente." | Destaca feedback |
| Sem conexão | "Servidor offline ou sem conexão." | Destaca feedback |
| Erro do servidor | Mensagem retornada pela API | Destaca feedback |

---

## ♿ Acessibilidade

✅ Labels associados aos inputs
✅ aria-label para inputs sem label visível
✅ role="alert" para mensagens de feedback
✅ Focus visível para navegação por teclado
✅ Enter para submit de formulários
✅ Suporte a modo de redução de movimento (prefers-reduced-motion)
✅ Contrast ratio adequado (WCAG AA)
✅ Font-size mínimo de 16px nos inputs (iOS)

---

## 📱 Responsividade

| Breakpoint | Mudanças |
|-----------|----------|
| **< 480px** | Padding reduzido, font-size 16px nos inputs |
| **480px - 768px** | Layout padrão com padding normal |
| **> 768px** | Layout otimizado para desktop |

---

## 🔒 Segurança

✅ Validação frontend (não confia apenas nisso)
✅ Requisições HTTPS (configure no produção)
✅ Timeout de 5 segundos em requisições
✅ Sanitização de entrada (sem eval, innerHTML, etc)
✅ Senhas nunca armazenadas em localStorage
✅ Links para LGPD abrem em nova aba (rel="noopener")

---

## 🚀 Deploy em Produção

### 1. Alterar URL da API

```javascript
// ❌ Desenvolvimento
const CONFIG = {
    API_BASE: 'http://localhost:3000/api/usuarios',
};

// ✅ Produção
const CONFIG = {
    API_BASE: 'https://api.finea.app/api/usuarios',
};
```

### 2. Configurar CORS no Backend

```javascript
const cors = require('cors');
app.use(cors({
    origin: 'https://finea.app',
    credentials: true
}));
```

### 3. Usar HTTPS

Certifique-se de que tanto frontend quanto backend usam HTTPS.

### 4. Variáveis de Ambiente

Use `.env` para armazenar URLs:

```env
VITE_API_URL=https://api.finea.app/api/usuarios
```

---

## 📞 Suporte

Se encontrar problemas:

1. Verifique se o servidor backend está rodando
2. Confirme se a URL da API está correta
3. Abra DevTools (F12) e verifique logs de erro
4. Verifique resposta da API no Network tab
5. Confirme se CORS está habilitado no backend

---

## ✅ Checklist de Integração

- [ ] Arquivo `login.html` adicionado ao projeto
- [ ] Express servindo arquivo como static
- [ ] Endpoints `/api/usuarios/login` e `/api/usuarios/cadastro` funcionando
- [ ] Banco de dados com tabela `cadastro` criada
- [ ] Links LGPD apontando para arquivos corretos
- [ ] localStorage funcionando (test no DevTools)
- [ ] Redirecionamento para dashboard após login
- [ ] Mensagens de erro/sucesso aparecendo corretamente
- [ ] Página responsiva em mobile
- [ ] HTTPS configurado em produção

---

**Versão:** 1.0 - Agosto 2026
**Status:** ✅ Pronto para Produção
