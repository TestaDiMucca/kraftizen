import { sendChat } from '../character/chatLines';
import { DEFAULT_CHAT_WAIT } from './constants';
import { KraftizenBot } from './types';

type ChatChoices = Record<
  string,
  null | ((response: string) => Promise<void> | void)
>;

/** Words to exit out of decision making without triggering anything */
const cancelWords = ['exit', 'cancel', 'never mind'];

/**
 * When active, we will process chats here
 *
 * We only answer whoever initiated this decision listener to make sure
 * the command is not thrown off by other chatter, and prevent the need to
 * answer by addressing the kraftizen by name e.g. "yes, BOT-KT-0072"
 */
class ChatDecisionTree {
  maxWait: number;
  bot: KraftizenBot;
  options: ChatChoices | null = null;
  chattingWith: string | null = null;

  waitTimer: ReturnType<typeof setTimeout>;

  constructor(bot: KraftizenBot, maxWait: number = DEFAULT_CHAT_WAIT) {
    this.bot = bot;
    this.maxWait = maxWait;
  }

  public promptResponse = ({
    maxWait,
    options,
    chattingWith,
    prompt,
  }: {
    maxWait?: number;
    options: ChatChoices;
    chattingWith: string;
    prompt: string;
  }) => {
    this.options = options;
    this.chattingWith = chattingWith;
    this.initTimeout(maxWait);
    sendChat(this.bot, prompt);
  };

  public handleChat = async (username: string, rawMessage: string) => {
    if (!this.options) {
      console.warn('Chat decision triggered without options set.');
      this.reset();
      return;
    }

    console.log('handle chat inner');

    if (username !== this.chattingWith) return;

    const message = rawMessage.toLowerCase();

    if (cancelWords.some((word) => message.startsWith(word))) {
      sendChat(this.bot, 'cancelChoice');
      return;
    }

    const optionTriggered = Object.keys(this.options).find((option) =>
      message.startsWith(option)
    );

    console.log('triggered', message, optionTriggered);

    if (!optionTriggered) return;
    const callback = this.options[optionTriggered];

    this.reset();

    if (callback === null) {
      sendChat(this.bot, 'ok');
      this.reset();
      return;
    }

    try {
      await callback(message);
    } catch (e) {
      console.error('Error handling response', e);
      sendChat(this.bot, 'error');
    } finally {
      this.reset();
    }
  };

  public isListening = () => this.options !== null;

  private reset = () => {
    this.options = null;
    this.chattingWith = null;
    if (this.waitTimer) clearTimeout(this.waitTimer);
    this.waitTimer = null;
  };

  private initTimeout = (wait = this.maxWait) => {
    if (this.waitTimer) clearTimeout(this.waitTimer);

    this.waitTimer = setTimeout(this.reset, wait);
  };
}

export default ChatDecisionTree;
