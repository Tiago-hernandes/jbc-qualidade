# Como configurar o Sistema de Qualidade JBC

## 1. Criar projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Clique em "Adicionar projeto"
3. Nome: `jbc-qualidade` (ou qualquer nome)
4. Ative o Google Analytics se quiser (opcional)

## 2. Ativar Authentication

1. No menu lateral, clique em **Authentication**
2. Clique em **Começar**
3. Na aba **Sign-in method**, ative **E-mail/senha**

## 3. Criar Firestore Database

1. No menu lateral, clique em **Firestore Database**
2. Clique em **Criar banco de dados**
3. Escolha **Iniciar no modo de produção**
4. Selecione a região mais próxima (ex: `southamerica-east1`)

## 4. Ativar Storage

1. No menu lateral, clique em **Storage**
2. Clique em **Começar**
3. Aceite as regras padrão

## 5. Copiar as credenciais

1. Vá em **Configurações do projeto** (ícone de engrenagem)
2. Desça até **Seus apps** e clique em **</>** (Web)
3. Registre o app com o nome `jbc-web`
4. Copie os valores do `firebaseConfig`
5. Cole no arquivo `.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=jbc-qualidade.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=jbc-qualidade
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=jbc-qualidade.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## 6. Configurar regras do Firestore

No Firebase Console > Firestore > Regras, cole:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /usuarios/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if request.auth != null;
    }
    match /fichas/{fichaId} {
      allow read, write: if request.auth != null;
    }
    match /alertas/{alertaId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 7. Rodar o sistema

```bash
cd sistema
npm run dev
```

Acesse: http://localhost:3000

## 8. Criar primeiro usuário

1. Acesse http://localhost:3000/registro
2. Use o **Código da Empresa**: `JBC001`
3. Selecione o cargo **Admin** para o primeiro usuário
