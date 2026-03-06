import { useNavigate } from "react-router-dom";
import HeroSetup from "../../components/HeroSetup";
import { useCreateWizard } from "../CreatePage";

export default function HeroStep() {
  const navigate = useNavigate();
  const { bookType, handleHeroComplete } = useCreateWizard();

  return (
    <HeroSetup
      bookType={bookType}
      onComplete={handleHeroComplete}
      onBack={() => navigate("/create")}
    />
  );
}
