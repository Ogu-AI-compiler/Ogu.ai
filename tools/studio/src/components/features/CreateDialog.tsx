import { useState } from "react";
import { styled, YStack, XStack, Text, Input } from "tamagui";

const Overlay = styled(YStack, {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
});

const Dialog = styled(YStack, {
  backgroundColor: "#1a1a2e",
  borderRadius: "$4",
  padding: "$7",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  gap: "$5",
  width: 420,
});

const Btn = styled(YStack, {
  borderRadius: "$3",
  paddingHorizontal: "$5",
  paddingVertical: "$3",
  cursor: "pointer",
  alignItems: "center",
});

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (slug: string) => void;
}

export function CreateDialog({ open, onClose, onCreate }: Props) {
  const [slug, setSlug] = useState("");

  if (!open) return null;

  const handleCreate = () => {
    const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (s) { onCreate(s); setSlug(""); onClose(); }
  };

  return (
    <Overlay onPress={onClose}>
      <Dialog onPress={(e: any) => e.stopPropagation()}>
        <Text fontSize="$6" fontWeight="700" color="$color">New Feature</Text>
        <Input
          size="$4"
          placeholder="feature-slug"
          placeholderTextColor="#7a7a7a"
          value={slug}
          onChangeText={setSlug}
          fontFamily="$body"
          backgroundColor="rgba(15,15,23,0.8)"
          borderColor="rgba(255,255,255,0.08)"
          borderRadius="$3"
          color="$color"
          onSubmitEditing={handleCreate}
          autoFocus
        />
        <XStack gap="$3" justifyContent="flex-end">
          <Btn backgroundColor="rgba(255,255,255,0.04)" hoverStyle={{ backgroundColor: "rgba(255,255,255,0.08)" }} onPress={onClose}>
            <Text fontSize="$3" color="#b3b3b3">Cancel</Text>
          </Btn>
          <Btn backgroundColor="#d4d4d4" hoverStyle={{ backgroundColor: "#e4e4e4" }} onPress={handleCreate}>
            <Text fontSize="$3" fontWeight="600" color="white">Create</Text>
          </Btn>
        </XStack>
      </Dialog>
    </Overlay>
  );
}
