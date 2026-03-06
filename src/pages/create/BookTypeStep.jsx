import { useNavigate } from "react-router-dom";
import BookTypePicker from "../../components/BookTypePicker";
import { useCreateWizard } from "../CreatePage";

export default function BookTypeStep() {
  const navigate = useNavigate();
  const { handleBookTypeSelect } = useCreateWizard();

  return (
    <BookTypePicker
      onSelect={handleBookTypeSelect}
      onBack={() => navigate("/")}
    />
  );
}
