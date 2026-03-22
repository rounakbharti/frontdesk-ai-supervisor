import os
import logging
import requests as http_requests
from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, AutoSubscribe, JobContext, WorkerOptions, cli
from livekit.agents.llm import function_tool
from livekit.plugins import openai, deepgram, silero

# Load root .env from the monorepo configuration securely
load_dotenv(dotenv_path="../.env")

logger = logging.getLogger("frontdesk-agent")

# Microservice API endpoints internally
HELP_REQUEST_URL = "http://localhost:3001/api/requests"
KB_SEARCH_URL = "http://localhost:3002/api/search"

SYSTEM_PROMPT = """You are a helpful receptionist for 'Lumiere Salon'. 
Your job is to answer customer questions about our salon (hours: 9am-6pm, services: haircuts and coloring).
If the customer asks a question you do NOT know the answer to, you MUST call the `escalate_to_supervisor` tool immediately. 
Do not guess answers. Empathize with the caller and state exactly: "Let me check with my supervisor and get back to you".
"""


class FrontdeskAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions=SYSTEM_PROMPT,
        )

    @function_tool()
    async def escalate_to_supervisor(
        self,
        caller_phone: str,
        question: str,
    ):
        """Escalates a question to the human supervisor when you do not know the answer.
        
        Args:
            caller_phone: The phone number of the caller (make a fake one up if not known)
            question: The specific question you cannot answer
        """
        logger.info(f"Escalating: {question} for {caller_phone}")
        
        # Phase 6 Core requirement: Check Knowledge Base first (graceful fallback)
        try:
            kb_res = http_requests.post(KB_SEARCH_URL, json={"query": question}, timeout=3)
            if kb_res.status_code == 200:
                hits = kb_res.json().get("hits", [])
                if hits:
                    return f"I actually just found the answer in my knowledge base: {hits[0]['answer']}"
        except Exception as kb_err:
            logger.warning(f"KB lookup failed (non-critical): {kb_err}")

        # If genuinely unresolved, push to Help Request Service API
        try:
            payload = {
                "caller_phone": caller_phone or "+15550000000",
                "question": question,
                "context": "Voice escalation."
            }
            res = http_requests.post(HELP_REQUEST_URL, json=payload, timeout=3)
            if res.status_code == 201:
                return "I have submitted the request to my supervisor. I will text you as soon as they reply!"
            else:
                return "I had trouble contacting my supervisor, please try again later."
        except Exception as e:
            logger.error(f"Escalation to help-request failed: {e}")
            return "Sorry, my internal systems are down. I cannot escalate right now."


async def entrypoint(ctx: JobContext):
    logger.info("Initializing Agent Session...")

    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(),
        llm=openai.LLM(
            api_key=os.environ.get("GROQ_API_KEY"),
            base_url="https://api.groq.com/openai/v1",
            model="llama-3.3-70b-versatile"
        ),
        tts=deepgram.TTS(),
    )

    await session.start(
        room=ctx.room,
        agent=FrontdeskAgent(),
    )

    await session.say("Welcome to Lumiere Salon! How can I help you today?", allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
