import { matchFormSchema, MatchFormValue } from "@common/shared-types";
import {
  Box,
  Button,
  Group,
  LoadingOverlay,
  Paper,
  Select,
  Stack,
} from "@mantine/core";
import { useForm, zodResolver } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { fetchQuestions } from "../../queries/questionQueries";
import MatchingTimer from "./MatchingTimer";
import socket from "../../socket/match";
import {
  MessageType,
  UserMatchDoneData,
  UserTicketPlayload,
  UserMatchingRequest,
  DIFFCULTY_LEVELS,
} from "@common/shared-types";

export function MatchingForm() {
  type Complexity = (typeof DIFFCULTY_LEVELS)[number];

  const [isMatching, setIsMatching] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const { data: questions, isLoading } = useQuery({
    queryKey: ["questions"],
    queryFn: fetchQuestions,
    initialData: [],
  });

  const form = useForm({
    initialValues: {
      complexity: "" as Complexity,
      category: "",
    },
    validate: zodResolver(matchFormSchema),
  });

  const complexities = ["Easy", "Medium", "Hard"].filter((c) =>
    questions?.some((q) => q.complexity === c)
  );

  const match = (values: MatchFormValue) => {
    setIsMatching(!isMatching);

    const data: UserMatchingRequest = {
      difficulty: values.complexity,
      topic: values.category,
    };
    socket.emit("MATCH_REQUEST", data);
  };

  const cancel = () => {
    setIsMatching(false);

    if (!ticketId) {
      throw new Error("Cannot cancel for undefined ticketId");
    }
    const { complexity, category } = form.values;
    const ticket: UserTicketPlayload = {
      ticketId: ticketId,
      data: {
        difficulty: complexity,
        topic: category,
      },
    };
    socket.emit(MessageType.MATCH_CANCEL, ticket);
  };

  useEffect(() => {
    socket.on(MessageType.MATCH_REQUEST_QUEUED, (data: string) => {
      console.log(`Match request queued for user`, data);
      setTicketId(data);
    });

    socket.on(MessageType.MATCH_REQUEST_FAILED, () => {
      setIsMatching(false);
      notifications.show({
        title: "Failed",
        message: "Match request failed",
        color: "red",
      });
    });

    socket.on(MessageType.AUTHENTICATION_FAILED, () => {
      setIsMatching(false);
      notifications.show({
        title: "Failed",
        message: "Authentication failed",
        color: "red",
      });
    });

    socket.on(MessageType.MATCH_FOUND, (data: UserMatchDoneData) => {
      setIsMatching(false);
      notifications.show({
        title: "Success",
        message: "Match found",
        color: "green",
      });
      console.log(`Match found for users: ${data.userIds}`);
    });

    socket.on(MessageType.MATCH_CANCELLED, () => {
      notifications.show({
        title: "Match cancelled",
        message: "No match found",
        color: "red",
      });
    });
  }, []);

  return (
    <form onSubmit={form.onSubmit((values) => match(values))}>
      <Box pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Paper withBorder shadow="md" radius="md" w={600} p={30} mt={30}>
          {/* Initial state of selection */}
          {!isMatching && (
            <Stack>
              <Group w="100%" justify="space-between" grow>
                <Select
                  label="Difficulty"
                  placeholder="Select difficulty"
                  required
                  data={complexities}
                  {...form.getInputProps("complexity")}
                />

                <Select
                  label="Category"
                  placeholder="Select category"
                  required
                  data={Array.from(
                    new Set(questions?.map((q) => q.categories).flat())
                  ).sort()}
                  {...form.getInputProps("category")}
                />
              </Group>
              <Button type="submit"> Match </Button>
            </Stack>
          )}

          {/* Matching state */}
          {isMatching && (
            <MatchingTimer time={30} isMatching={isMatching} cancel={cancel} />
          )}
        </Paper>
      </Box>
    </form>
  );
}
