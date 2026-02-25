const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Supabase Setup
const supabaseUrl = 'https://tiijcucsfqdylqpnzlxt.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaWpjdWNzZnFkeWxxcG56bHh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDkzOTIsImV4cCI6MjA4NzUyNTM5Mn0.UTZuVCU73dqrf3JW161T97RGNxijU0z0kxtvnr8PVic';
const supabase = createClient(supabaseUrl, supabaseKey);

// WhatsApp Setup
const PHONE_ID = '955083994361759';
const ACCESS_TOKEN = 'EAAdl3xgZCPZBoBQ2F5AZCvZA5w3FWPZCEJPkBOsAOuoSsZCZBuCevEmsm1ZC0HZCNd37HDb9PEIGZBOqOZCmF27rpy99klURdj8QD5uPSdUI3Drl48UzZCem9CFiqLP6AZBBfltd3gZBEFvlU0rCPMbClI7fJ4ThakZBBrhCeVZBzXd72QChLC19XfaVoZCfZCCJSNTESAZA0IIyG9sfRnI90MnyfszJFCjPNGZCZAiZAKOIhhqWR5TzvxZBCraOwf5dgZDZD';
const WA_VERSION = 'v18.0';

const services = [
  { id: 1, name: 'التصميم المعماري والديكور الداخلي', employee: 'أحمد غازي', phone: '966555720166' },
  { id: 2, name: 'التصميم الإنشائي والحسابات', employee: 'محمد غازي', phone: '966555877142' },
  { id: 3, name: 'الإشراف والمتابعة على التنفيذ', employee: 'محمد غازي', phone: '966555877142' },
  { id: 4, name: 'الرفع المساحي والطبوغرافي', employee: 'محمد غازي', phone: '966555877142' },
  { id: 5, name: 'الدراسات الجيوتقنية والتربة', employee: 'محمد غازي', phone: '966555877142' },
  { id: 6, name: 'تقارير الجدوى والتقييم الفني', employee: 'محمد غازي', phone: '966555877142' },
  { id: 7, name: 'خدمات السلامة', employee: 'محمد غازي', phone: '966555877142' },
  { id: 8, name: 'خدمات الصيانة والتشغيل', employee: 'محمد غازي', phone: '966555877142' }
];

// Send Message Function
async function sendMessage(to, body, type = 'text', extra = {}) {
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type,
    [type]: { body, ...extra }
  };
  await axios.post(`https://graph.facebook.com/${WA_VERSION}/${PHONE_ID}/messages`, payload, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  });
}

// Webhook for Verification
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'your_verify_token') {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// Webhook for Messages
app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    const msgType = message.type;

    // Get Conversation State
    let { data: conv } = await supabase.from('conversations').select('*').eq('phone', from).single();
    if (!conv) {
      await supabase.from('conversations').insert({ phone: from });
      conv = { current_step: 'welcome' };
    }

    if (msgType === 'text' || msgType === 'interactive') {
      if (conv.current_step === 'welcome') {
        await sendMessage(from, 'أهلاً وسهلاً بك في **مكتب غازي عباس للاستشارات الهندسية** 📍 جازان\n\nنحن هنا لخدمتك في كل احتياجاتك الهندسية بأعلى جودة وسرعة.\n\nمن فضلك، أدخل اسمك الكامل لنتمكن من خدمتك بشكل أفضل 👤');
        await supabase.from('conversations').update({ current_step: 'waiting_name' }).eq('phone', from);
      } else if (conv.current_step === 'waiting_name') {
        const name = message.text.body;
        await supabase.from('conversations').update({ temp_name: name, current_step: 'service_selection' }).eq('phone', from);
        const listSections = services.map(s => ({ title: s.name, description: '', id: s.id.toString() }));
        await sendMessage(from, 'شكراً لك يا ' + name + '! 👍\n\nاختر الخدمة التي تحتاجها من القائمة أدناه 👇', 'list_message', {
          header: { type: 'text', text: 'الخدمات' },
          body: 'اختر خدمة واحدة',
          footer: 'مكتب غازي عباس',
          sections: [{ title: 'الخدمات', rows: listSections }]
        });
      } else if (conv.current_step === 'service_selection' && msgType === 'interactive' && message.interactive.type === 'list_reply') {
        const selectedId = parseInt(message.interactive.list_reply.id);
        const selectedService = services.find(s => s.id === selectedId);
        const name = conv.temp_name;
        // Save to DB
        await supabase.from('clients').upsert({
          phone: from,
          name,
          service_id: selectedId,
          service_name: selectedService.name,
          employee_name: selectedService.employee,
          employee_phone: selectedService.phone
        });
        // Send Redirect
        await sendMessage(from, 'شكراً يا ' + name + '!\n\nتم تسجيل طلبك لخدمة: **' + selectedService.name + '**\n\nسيتم تحويلك الآن مباشرة إلى **المهندس ' + selectedService.employee + '** المتخصص في هذه الخدمة.\n\nاضغط على الرابط التالي للتواصل الفوري:\nhttps://wa.me/' + selectedService.phone + '?text=مرحباً، اسمي ' + name + '، جئت من البوت عن خدمة ' + selectedService.name);
        await supabase.from('conversations').update({ current_step: 'done' }).eq('phone', from);
      }
    }
  }
  res.sendStatus(200);
});

// Start Server
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
app.listen(port, () => console.log(`Server running on port ${port}`));
