import { ChatSearchParams } from '@/constants/chat';
import {
  IConversation,
  IDialog,
  IStats,
  IToken,
  Message,
} from '@/interfaces/database/chat';
import i18n from '@/locales/config';
import { IClientConversation, IMessage } from '@/pages/chat/interface';
import chatService from '@/services/chat-service';
import { isConversationIdExist } from '@/utils/chat';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'umi';
import { v4 as uuid } from 'uuid';

//#region logic

export const useClickDialogCard = () => {
  const [, setSearchParams] = useSearchParams();

  const newQueryParameters: URLSearchParams = useMemo(() => {
    return new URLSearchParams();
  }, []);

  const handleClickDialog = useCallback(
    (dialogId: string) => {
      newQueryParameters.set(ChatSearchParams.DialogId, dialogId);
      // newQueryParameters.set(
      //   ChatSearchParams.ConversationId,
      //   EmptyConversationId,
      // );
      setSearchParams(newQueryParameters);
    },
    [newQueryParameters, setSearchParams],
  );

  return { handleClickDialog };
};

export const useGetChatSearchParams = () => {
  const [currentQueryParameters] = useSearchParams();

  return {
    dialogId: currentQueryParameters.get(ChatSearchParams.DialogId) || '',
    conversationId:
      currentQueryParameters.get(ChatSearchParams.ConversationId) || '',
  };
};

//#endregion

//#region dialog

export const useFetchNextDialogList = () => {
  const { handleClickDialog } = useClickDialogCard();

  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery<IDialog[]>({
    queryKey: ['fetchDialogList'],
    initialData: [],
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await chatService.listDialog();

      if (data.retcode === 0 && data.data.length > 0) {
        handleClickDialog(data.data[0].id);
      }

      return data?.data ?? [];
    },
  });

  return { data, loading, refetch };
};

export const useSetNextDialog = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['setDialog'],
    mutationFn: async (params: IDialog) => {
      const { data } = await chatService.setDialog(params);
      if (data.retcode === 0) {
        queryClient.invalidateQueries({ queryKey: ['fetchDialogList'] });
        message.success(
          i18n.t(`message.${params.dialog_id ? 'modified' : 'created'}`),
        );
      }
      return data?.retcode;
    },
  });

  return { data, loading, setDialog: mutateAsync };
};

export const useFetchNextDialog = () => {
  const { dialogId } = useGetChatSearchParams();

  const { data, isFetching: loading } = useQuery<IDialog>({
    queryKey: ['fetchDialog', dialogId],
    gcTime: 0,
    initialData: {} as IDialog,
    enabled: !!dialogId,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await chatService.getDialog({ dialogId });

      return data?.data ?? ({} as IDialog);
    },
  });

  return { data, loading };
};

export const useFetchManualDialog = () => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['fetchManualDialog'],
    gcTime: 0,
    mutationFn: async (dialogId: string) => {
      const { data } = await chatService.getDialog({ dialogId });

      return data;
    },
  });

  return { data, loading, fetchDialog: mutateAsync };
};

export const useRemoveNextDialog = () => {
  const queryClient = useQueryClient();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['removeDialog'],
    mutationFn: async (dialogIds: string[]) => {
      const { data } = await chatService.removeDialog({ dialogIds });
      if (data.retcode === 0) {
        queryClient.invalidateQueries({ queryKey: ['fetchDialogList'] });
        message.success(i18n.t('message.deleted'));
      }
      return data.retcode;
    },
  });

  return { data, loading, removeDialog: mutateAsync };
};

//#endregion

//#region conversation

export const useFetchNextConversationList = () => {
  const { dialogId } = useGetChatSearchParams();
  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery<IConversation[]>({
    queryKey: ['fetchConversationList', dialogId],
    initialData: [],
    gcTime: 0,
    refetchOnWindowFocus: false,
    enabled: !!dialogId,
    queryFn: async () => {
      const { data } = await chatService.listConversation({ dialogId });

      return data?.data;
    },
  });

  return { data, loading, refetch };
};

export const useFetchNextConversation = () => {
  const { conversationId } = useGetChatSearchParams();
  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery<IClientConversation>({
    queryKey: ['fetchConversation', conversationId],
    initialData: {} as IClientConversation,
    // enabled: isConversationIdExist(conversationId),
    gcTime: 0,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (isConversationIdExist(conversationId)) {
        const { data } = await chatService.getConversation({ conversationId });
        // if (data.retcode === 0 && needToBeSaved) {
        //   yield put({
        //     type: 'kFModel/fetch_document_thumbnails',
        //     payload: {
        //       doc_ids: getDocumentIdsFromConversionReference(data.data),
        //     },
        //   });
        //   yield put({ type: 'setCurrentConversation', payload: data.data });
        // }
        const conversation = data?.data ?? {};

        const messageList =
          conversation?.message?.map((x: Message | IMessage) => ({
            ...x,
            id: 'id' in x && x.id ? x.id : uuid(),
          })) ?? [];

        return { ...conversation, message: messageList };
      }
      return { message: [] };
    },
  });

  return { data, loading, refetch };
};

export const useFetchManualConversation = () => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['fetchManualConversation'],
    gcTime: 0,
    mutationFn: async (conversationId: string) => {
      const { data } = await chatService.getConversation({ conversationId });

      return data;
    },
  });

  return { data, loading, fetchConversation: mutateAsync };
};

export const useUpdateNextConversation = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['updateConversation'],
    mutationFn: async (params: Record<string, any>) => {
      const { data } = await chatService.setConversation(params);
      if (data.retcode === 0) {
        queryClient.invalidateQueries({ queryKey: ['fetchConversationList'] });
      }
      return data;
    },
  });

  return { data, loading, updateConversation: mutateAsync };
};

export const useRemoveNextConversation = () => {
  const queryClient = useQueryClient();
  const { dialogId } = useGetChatSearchParams();

  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['removeConversation'],
    mutationFn: async (conversationIds: string[]) => {
      const { data } = await chatService.removeConversation({
        conversationIds,
        dialogId,
      });
      if (data.retcode === 0) {
        queryClient.invalidateQueries({ queryKey: ['fetchConversationList'] });
      }
      return data.retcode;
    },
  });

  return { data, loading, removeConversation: mutateAsync };
};
//#endregion

// #region API provided for external calls

export const useCreateNextToken = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['createToken'],
    mutationFn: async (params: Record<string, any>) => {
      const { data } = await chatService.createToken(params);
      if (data.retcode === 0) {
        queryClient.invalidateQueries({ queryKey: ['fetchTokenList'] });
      }
      return data?.data ?? [];
    },
  });

  return { data, loading, createToken: mutateAsync };
};

export const useFetchTokenList = (params: Record<string, any>) => {
  const {
    data,
    isFetching: loading,
    refetch,
  } = useQuery<IToken[]>({
    queryKey: ['fetchTokenList', params],
    initialData: [],
    gcTime: 0,
    queryFn: async () => {
      const { data } = await chatService.listToken(params);

      return data?.data ?? [];
    },
  });

  return { data, loading, refetch };
};

export const useRemoveNextToken = () => {
  const queryClient = useQueryClient();
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['removeToken'],
    mutationFn: async (params: {
      tenantId: string;
      dialogId: string;
      tokens: string[];
    }) => {
      const { data } = await chatService.removeToken(params);
      if (data.retcode === 0) {
        queryClient.invalidateQueries({ queryKey: ['fetchTokenList'] });
      }
      return data?.data ?? [];
    },
  });

  return { data, loading, removeToken: mutateAsync };
};

type RangeValue = [Dayjs | null, Dayjs | null] | null;

const getDay = (date?: Dayjs) => date?.format('YYYY-MM-DD');

export const useFetchNextStats = () => {
  const [pickerValue, setPickerValue] = useState<RangeValue>([
    dayjs().subtract(7, 'day'),
    dayjs(),
  ]);
  const { data, isFetching: loading } = useQuery<IStats>({
    queryKey: ['fetchStats', pickerValue],
    initialData: {} as IStats,
    gcTime: 0,
    queryFn: async () => {
      if (Array.isArray(pickerValue) && pickerValue[0]) {
        const { data } = await chatService.getStats({
          fromDate: getDay(pickerValue[0]),
          toDate: getDay(pickerValue[1] ?? dayjs()),
        });
        return data?.data ?? {};
      }
      return {};
    },
  });

  return { data, loading, pickerValue, setPickerValue };
};

//#endregion

//#region shared chat

export const useCreateNextSharedConversation = () => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['createSharedConversation'],
    mutationFn: async (userId?: string) => {
      const { data } = await chatService.createExternalConversation({ userId });

      return data;
    },
  });

  return { data, loading, createSharedConversation: mutateAsync };
};

export const useFetchNextSharedConversation = () => {
  const {
    data,
    isPending: loading,
    mutateAsync,
  } = useMutation({
    mutationKey: ['fetchSharedConversation'],
    mutationFn: async (conversationId: string) => {
      const { data } = await chatService.getExternalConversation(
        null,
        conversationId,
      );

      return data;
    },
  });

  return { data, loading, fetchConversation: mutateAsync };
};

//#endregion
