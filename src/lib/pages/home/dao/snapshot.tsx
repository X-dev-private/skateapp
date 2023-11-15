import * as React from 'react';
import { useEffect, useState } from 'react';
import { Box, Text, Flex, VStack, Image, Button, Skeleton, Badge, HStack, useBreakpointValue, useMediaQuery, SimpleGrid } from '@chakra-ui/react';
import DaoStatus from './DaoStatus';
import { proposalsQuery } from './queries';
import { Proposal } from './types';
import ProposalModal from './proposalModal';
import OpenAI from 'openai';

const SkatehiveProposals: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const placeholderImage = '/assets/skatehive-logo.png';
  const [loadingProposals, setLoadingProposals] = useState<boolean>(true);
  const [loadingSummaries, setLoadingSummaries] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<string>('');
  const [modalTitle, setModalTitle] = useState<string>('');
  const handleOpenModal = ({ body, title }: { body: string; title: string }) => {
    setModalContent(body);
    setModalTitle(title);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    dangerouslyAllowBrowser: true,
  });
  const getSummary = async (body: string) => {
    const cachedSummary = localStorage.getItem(body);
    if (cachedSummary) {
      return cachedSummary;
      setLoadingSummaries(false);
    }
    const response = await openai.chat.completions.create({
      messages: [{ role: 'user', content: `Summarize the following proposal in 3 sentences: ${body}` }],
      model: 'gpt-3.5-turbo',
    });
    console.log('response', response);
    const summary = response.choices[0]?.message?.content || 'No summary available.';
    localStorage.setItem(body, summary);
    console.log('summary', summary);
    console.log('Summary fetched and cached.');
    return summary;
  };
  const transformIpfsUrl = (ipfsUrl: string) => {
    return ipfsUrl.replace('ipfs://', 'https://snapshot.4everland.link/ipfs/');
  };
  const findImage = (body: string) => {
    const imgRegex = /!\[.*?\]\((.*?)\)/;
    const match = body.match(imgRegex);
    const imageUrl = match ? match[1] : placeholderImage;
    return imageUrl.startsWith('ipfs://') ? transformIpfsUrl(imageUrl) : imageUrl;
  };
  const fetchProposals = async () => {
    try {
      const response = await fetch('https://hub.snapshot.org/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: proposalsQuery }),
      });
      console.log('response2', response);
      if (response.ok) {
        const data = await response.json();
        console.log('data', data);
        if (data.errors) {
          console.error('GraphQL Proposals Error:', data.errors);
          return;
        }
        const fetchedProposals = data.data.proposals;
        console.log('fetchedProposals', fetchedProposals);
        setProposals(fetchedProposals);
        setLoadingProposals(false);
        setLoadingSummaries(true);
        for (let proposal of fetchedProposals) {
          proposal.summary = await getSummary(proposal.body);
        }
        setLoadingSummaries(false);
      } else {
        console.error('Error fetching proposals:', await response.text());
      }
    } catch (error) {
      console.error('Error fetching proposals:', error);
      setLoadingProposals(false);
    }
  };
  const query = proposalsQuery;
  useEffect(() => {
    const cachedProposals = localStorage.getItem('proposals');
    if (cachedProposals) {
      setProposals(JSON.parse(cachedProposals));
      setLoadingProposals(false);
      setLoadingSummaries(true);
      (async () => {
        for (let proposal of JSON.parse(cachedProposals)) {
          proposal.summary = await getSummary(proposal.body);
        }
        setLoadingSummaries(false);
      })();
    } else {
      fetchProposals();
    }
  }, []);
  const [isMobile] = useMediaQuery('(max-width: 768px)');
  return (
    <Flex flexDirection="column">
      <DaoStatus />
      <Flex justify={"center"}>
        <Text border="1px solid white" borderRadius="10px" padding="8px" fontSize="2xl" color="white">
          Governance
        </Text>
      </Flex>
      <SimpleGrid mx="auto" maxWidth={"87%"} columns={{ base: 1, md: 2 }} spacing={3} mt={3}>
        {loadingProposals ? (
          Array.from({ length: 10 }).map((_, index) => (
            <Flex key={index} direction="column">
              {/* ... (loading placeholders for proposals) */}
            </Flex>
          ))
        ) : (
          proposals.map((proposal) => (
            <Flex key={proposal.id} borderWidth={1} borderRadius="md" border="2px solid orange" p={4} direction="column" backgroundColor="black" boxShadow="md" opacity={proposal.state === 'closed' ? 0.7 : 1}>
                
                {!isMobile && (
                  <Image
                    src={findImage(proposal.body)}
                    alt="Thumbnail"
                    boxSize="20%"
                    border="1px solid white"
                    borderRadius="md"
                    objectFit={"cover"}
                    onError={(e) => {
                      e.currentTarget.src = placeholderImage;
                    }}
                    mb={4}
                  />
                )}
                <Flex  flexDirection={!isMobile ? "row" : "column"}>
                  {isMobile && (
                    
                    <Image
                      src={findImage(proposal.body)}
                      alt="Thumbnail"
                      boxSize="50%"
                      alignSelf={"center"}
                      marginBottom={"10px"}
                      border="1px solid white"
                      borderRadius="md"
                      onError={(e) => {
                        e.currentTarget.src = placeholderImage;
                      }}
                      mr={4}
                    />
                  )}
                  <VStack paddingLeft="5px" align="start">
                    <Box minWidth="100%" borderRadius="10px" border="1px solid white">
                      <Text
                        padding="5px"
                        color="white"
                        fontSize="xl"
                        onClick={() => handleOpenModal({ body: proposal.body, title: proposal.title })}
                        cursor="pointer"
                      >
                        {proposal.title}
                      </Text>
                    </Box>
                    <HStack alignContent="center">
                      <Badge
                        variant="subtle"
                        colorScheme={proposal.state === 'closed' ? 'red' : 'green'}
                        mb={2}
                      >
                        {proposal.state === 'closed' ? 'Closed' : 'Open'}
                      </Badge>
                      <Text color="white">
                        Author: {proposal.author.slice(0, 6)}...{proposal.author.slice(-4)}
                      </Text>
                    </HStack>
                    {loadingSummaries ? (
                      <Skeleton height="20px" width="100%" mt={2} />
                    ) : (
                      <Box paddingBottom="5px">
                        <Text
                          padding="5px"
                          color="aqua"
                          borderRadius="10px"
                          border="1px solid white"
                          cursor="pointer"
                          onClick={() => handleOpenModal({ body: proposal.body, title: proposal.title })}
                          mt={2}
                        >
                          🤖 GPT-Summary: {proposal.summary}
                        </Text>
                      </Box>
                    )}
                  </VStack>
                </Flex>
   
              <Flex borderRadius="10px" flexDirection="row" justifyContent="space-between">
                <Flex flexDirection="row" justifyContent="center" width="100%">
                  {proposal.choices.sort().reverse().map((choice, index) => (
                    <Button
                      key={index}
                      color="white"
                      backgroundColor="black"
                      border="1px solid orange"
                      mr={2}
                      mb={2}
                      borderRadius="md"
                      onClick={() => {
                        if (proposal.state === 'closed') {
                          alert("Voting is closed. You're late to vote! Lazy Ass...");
                        } else {
                          window.open(
                            `https://snapshot.org/#/skatehive.eth/proposal/${proposal.id}`,
                            '_blank'
                          );
                        }
                      }}
                    >
                      {choice}
                    </Button>
                  ))}
                </Flex>
              </Flex>
            </Flex>
          ))
        )}
      </SimpleGrid>
      <ProposalModal isOpen={isModalOpen} onClose={handleCloseModal} proposalContent={modalContent} proposalTitle={modalTitle} />
    </Flex>
  );
};
export default SkatehiveProposals;
