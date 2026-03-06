import { useNavigate } from "react-router-dom";
import StoryStudio from "../../components/StoryStudio";
import { useCreateWizard } from "../CreatePage";

export default function StudioStep() {
  const navigate = useNavigate();
  const { bookType, heroData, artStyle, handleStudioComplete } = useCreateWizard();

  return (
    <StoryStudio
      bookType={bookType}
      heroData={heroData}
      artStyle={artStyle}
      onComplete={handleStudioComplete}
      onBack={() => navigate("/create/style")}
    />
  );
}
