import { useNavigate } from "react-router-dom";
import StylePicker from "../../components/StylePicker";
import { useCreateWizard } from "../CreatePage";

export default function StyleStep() {
  const navigate = useNavigate();
  const { handleStyleSelect } = useCreateWizard();

  return (
    <StylePicker
      onSelect={handleStyleSelect}
      onBack={() => navigate("/create/hero")}
    />
  );
}
