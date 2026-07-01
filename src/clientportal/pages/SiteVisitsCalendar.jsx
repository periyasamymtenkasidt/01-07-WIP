import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Calendar, FileText, CheckCircle2, ChevronDown, ChevronUp, Image, Compass, ExternalLink } from "lucide-react";

const SiteVisitsCalendar = () => {
  const { client, appointments, handleCreateAppointment } = useOutletContext();
  const navigate = useNavigate();

  const [meetingSubject, setMeetingSubject] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [expandedAptIdx, setExpandedAptIdx] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!meetingSubject || !meetingDate || !meetingTime) return;
    handleCreateAppointment(meetingSubject, meetingDate, meetingTime);
    setMeetingSubject("");
    setMeetingDate("");
    setMeetingTime("");
  };

  const toggleExpandApt = (idx, status) => {
    if (status !== "Done") return; // Only completed appointments expand reports
    setExpandedAptIdx(expandedAptIdx === idx ? null : idx);
  };

  // Mock site survey summaries and data for completed visits
  const completedAptDetails = {
    0: {
      report: "Completed initial digital survey and inspection of the luxury villa structure. Core masonry works, structural slabs, and plaster layout verified against architectural elevations.",
      measurements: "Living Room: 18' x 14' · Kitchen: 12' x 10' · Foyer: 8' x 6' · Main Villa Ceiling Height: 10' 6\"",
      documents: ["Villa_Layout_Survey_V1.pdf", "Survey_Living_Room_Photos.zip"],
    },
    1: {
      report: "Walkthrough with Electrical Contractor Priya S. and Supervisor Vijay K. Plotted television wall sockets, electrical conduits, plumbing inlet connections, and air conditioner sleeve points in the kitchen and living area.",
      measurements: "Kitchen Utility Area: 6' x 4.5' · Electrical Conduit Runs: 145 meters · Bedroom Plugs: 12 points",
      documents: ["Electrical_Ceiling_Layout_Marked_V2.pdf"],
    },
    2: {
      report: "Detailed physical selection of laminates, wood veneers, and bath tiles at the design gallery with the client. Confirmed Scandinavian light-oak theme and selected quartz countertops for the kitchen.",
      measurements: "Quartz Countertop Area: 36 sq ft · Oak Laminate Boards: 14 sheets · Bathroom Accent Tile: 120 sq ft",
      documents: ["Material_Selection_Receipt_Approved.pdf", "Material_Board_Scandinavian.jpg"],
    }
  };

  return (
    <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 text-left">
      {/* Request form */}
      <div className="bg-slate-50 rounded-[20px] p-5 border border-gray-100 flex flex-col justify-between h-fit">
        <h4 className="text-[13px] font-bold text-darkgray uppercase tracking-wider mb-4">Request Consultation</h4>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-grey uppercase tracking-wider">Subject / Purpose</label>
            <input
              type="text"
              required
              value={meetingSubject}
              onChange={(e) => setMeetingSubject(e.target.value)}
              placeholder="E.g. Material review, site walk"
              className="w-full text-xs border border-bordergray rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-purple"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-grey uppercase tracking-wider">Preferred Date</label>
            <input
              type="date"
              required
              value={meetingDate}
              onChange={(e) => setMeetingDate(e.target.value)}
              className="w-full text-xs border border-bordergray rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-purple"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-grey uppercase tracking-wider">Preferred Time</label>
            <input
              type="text"
              required
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              placeholder="E.g. 10:00 AM - 12:00 PM"
              className="w-full text-xs border border-bordergray rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:border-purple"
            />
          </div>
          <button
            type="submit"
            className="w-full mt-4 py-2.5 bg-purple hover:bg-dark-blue text-white rounded-full text-xs font-bold shadow-sm transition-all text-center cursor-pointer"
          >
            Submit Request
          </button>
        </form>
      </div>

      {/* Appointments list */}
      <div className="lg:col-span-2 flex flex-col space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <h4 className="text-[13px] font-bold text-darkgray uppercase tracking-wider">
            Appointment History & Calendar
          </h4>
          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold">
            {appointments.length} total
          </span>
        </div>
        <div className="flex flex-col gap-3 pr-1">
          {appointments.map((apt, idx) => {
            const isCompleted = apt.status === "Done";
            const isExpanded = expandedAptIdx === idx;
            const details = completedAptDetails[idx];

            return (
              <div 
                key={idx} 
                className={`flex flex-col border border-gray-150 rounded-[20px] shadow-sm overflow-hidden bg-white transition-all ${
                  isCompleted ? "cursor-pointer hover:border-purple/35" : ""
                }`}
                onClick={() => toggleExpandApt(idx, apt.status)}
              >
                <div className="flex items-center justify-between p-4 hover:bg-slate-50/20">
                  <div className="flex items-center gap-4">
                    <div className="text-center w-12 h-12 bg-white rounded-xl flex flex-col justify-center items-center border border-bordergray shadow-sm shrink-0">
                      <div className="text-[15px] font-bold text-darkgray leading-none">{apt.date}</div>
                      <div className="text-[9px] text-gray-400 font-bold uppercase mt-1">{apt.month}</div>
                    </div>
                    <div className="text-left">
                      <h4 className="font-bold text-darkgray text-xs leading-snug flex items-center gap-1.5">
                        {apt.title}
                        {isCompleted && (
                          <span className="text-[9px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                            Report Available
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-text-subtle mt-0.5">{apt.time} · {apt.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`px-2.5 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider border ${apt.statusColor}`}>
                      {apt.status}
                    </div>
                    {isCompleted && (
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Site Visit Report Panel */}
                {isCompleted && isExpanded && details && (
                  <div className="px-5 pb-5 pt-3 bg-gradient-to-b from-white to-slate-50/50 border-t border-slate-100 space-y-4 text-xs text-left animate-slideDown">
                    
                    {/* Report Text */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText size={11} className="text-purple" />
                        Site Visit Report
                      </p>
                      <p className="text-slate-600 leading-relaxed font-semibold">{details.report}</p>
                    </div>

                    {/* Measurements */}
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Compass size={11} className="text-purple" />
                        Measurements Summary
                      </p>
                      <p className="text-slate-600 bg-slate-100/60 p-2 rounded-xl border border-slate-200/50 leading-relaxed font-medium">
                        {details.measurements}
                      </p>
                    </div>

                    {/* Survey Documents */}
                    {details.documents && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                          <Image size={11} className="text-purple" />
                          Survey Documents
                        </p>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          {details.documents.map((doc, docIdx) => (
                            <a
                              key={docIdx}
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                alert(`Downloading ${doc}...`);
                              }}
                              className="inline-flex items-center gap-1 bg-white border border-bordergray rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-purple hover:border-purple/40 shadow-xs transition-colors"
                            >
                              {doc}
                              <ExternalLink size={10} />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Shortcut to designs */}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/client-portal/${client.clientID}/designs-renders`);
                        }}
                        className="flex items-center gap-1 bg-purple text-white px-3.5 py-1.5 rounded-full text-[10px] font-bold hover:bg-dark-blue transition-colors cursor-pointer shadow-xs"
                      >
                        View Related Designs
                        <ExternalLink size={10} />
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10.5px] text-gray-400 mt-2 text-center italic font-medium">
          💡 Click on any completed ("Done") visit to expand its report and measurements.
        </p>
      </div>
    </div>
  );
};

export default SiteVisitsCalendar;
