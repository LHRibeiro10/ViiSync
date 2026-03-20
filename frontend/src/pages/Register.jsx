import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser, setSessionToken } from "../services/api";

function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptedTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  function updateField(field, value) {
    setFormData((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFeedback(null);

    if (
      !formData.name.trim() ||
      !formData.company.trim() ||
      !formData.email.trim() ||
      !formData.password.trim()
    ) {
      setFeedback({
        tone: "error",
        message: "Preencha os campos obrigatorios para continuar.",
      });
      return;
    }

    if (formData.password.length < 8) {
      setFeedback({
        tone: "error",
        message: "A senha deve ter pelo menos 8 caracteres.",
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFeedback({
        tone: "error",
        message: "A confirmacao de senha precisa ser igual a senha informada.",
      });
      return;
    }

    if (!formData.acceptedTerms) {
      setFeedback({
        tone: "error",
        message: "Voce precisa aceitar os termos para criar a conta.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await registerUser({
        name: formData.name,
        company: formData.company,
        email: formData.email,
        password: formData.password,
        rememberMe: true,
      });

      const token = response?.session?.token;

      if (!token) {
        throw new Error("Sessao nao recebida no cadastro.");
      }

      setSessionToken(token);
      setFeedback({
        tone: "success",
        message: "Conta criada com sucesso. Redirecionando...",
      });

      window.setTimeout(() => {
        navigate("/");
      }, 350);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error.message || "Nao foi possivel concluir o cadastro.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-shell">
      <div className="auth-form-copy">
        <span className="auth-form-kicker">Onboarding</span>
        <h2>Criar conta</h2>
        <p>
          Crie sua conta e o ViiSync ja prepara um workspace inicial com dados
          de operacao para voce comecar.
        </p>
      </div>

      <form className="auth-form auth-form-grid" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Nome</span>
          <input
            type="text"
            placeholder="Seu nome"
            value={formData.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Empresa ou loja</span>
          <input
            type="text"
            placeholder="Nome da operacao"
            value={formData.company}
            onChange={(event) => updateField("company", event.target.value)}
          />
        </label>

        <label className="auth-field auth-field-full">
          <span>Email</span>
          <input
            type="email"
            placeholder="operacao@empresa.com"
            value={formData.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Senha</span>
          <input
            type="password"
            placeholder="Crie uma senha"
            value={formData.password}
            onChange={(event) => updateField("password", event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Confirmar senha</span>
          <input
            type="password"
            placeholder="Repita a senha"
            value={formData.confirmPassword}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
          />
        </label>

        <label className="auth-checkbox auth-field-full">
          <input
            type="checkbox"
            checked={formData.acceptedTerms}
            onChange={(event) => updateField("acceptedTerms", event.target.checked)}
          />
          <span>
            Concordo com os termos de uso e com a criacao do espaco inicial da minha
            operacao dentro do ViiSync.
          </span>
        </label>

        <button
          type="submit"
          className="auth-submit-button auth-field-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </button>

        {feedback ? (
          <div
            className={`auth-feedback auth-field-full is-${feedback.tone}`}
          >
            {feedback.message}
          </div>
        ) : null}
      </form>

      <div className="auth-secondary-actions">
        <span>Ja tem uma conta?</span>
        <Link to="/login">Entrar</Link>
      </div>
    </div>
  );
}

export default Register;
