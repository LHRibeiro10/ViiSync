import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../services/api";
import { useAuthSession } from "../contexts/useAuthSession";

function Register() {
  const navigate = useNavigate();
  const { applySessionToken } = useAuthSession();
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
        message: "Preencha os campos obrigatórios para continuar.",
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
        message: "A confirmação da senha deve ser igual à senha informada.",
      });
      return;
    }

    if (!formData.acceptedTerms) {
      setFeedback({
        tone: "error",
        message: "Você precisa aceitar os termos para criar a conta.",
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
        throw new Error("Sessão não recebida no cadastro.");
      }

      await applySessionToken(token);
      setFeedback({
        tone: "success",
        message: "Conta criada com sucesso. Redirecionando...",
      });

      window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 350);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error.message || "Não foi possível concluir o cadastro.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-form-shell">
      <div className="auth-form-copy">
        <span className="auth-form-kicker">Cadastro da operação</span>
        <h2>Criar conta</h2>
        <p>Cadastre sua operação e entre no ViiSync em poucos passos.</p>
      </div>

      <form className="auth-form auth-form-grid" onSubmit={handleSubmit}>
        <label className="auth-field">
          <span>Nome</span>
          <input
            type="text"
            placeholder="Seu nome completo"
            value={formData.name}
            onChange={(event) => updateField("name", event.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Empresa</span>
          <input
            type="text"
            placeholder="Nome da operação"
            value={formData.company}
            onChange={(event) => updateField("company", event.target.value)}
          />
        </label>

        <label className="auth-field auth-field-full">
          <span>E-mail</span>
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
            Concordo com os Termos de Uso e com a criação do espaço inicial da minha operação no ViiSync.
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
        <span>Já possui acesso?</span>
        <Link to="/login">Entrar</Link>
      </div>
    </div>
  );
}

export default Register;
